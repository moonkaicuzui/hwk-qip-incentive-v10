/**
 * Cloud Functions for HWK QIP Incentive System V10
 *
 * AQL Workflow + HR V2 패턴 기반
 * Region: asia-northeast3 (Seoul)
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { sendEmail } = require("./services/emailService");
const {
  buildNewFeedbackEmail,
  buildReplyEmail,
  buildStatusChangeEmail,
} = require("./templates/feedbackEmail");
const {
  sendIncentiveMonthlyEmail,
} = require("./services/incentiveReportEmail");
const { sendDiscordMessage } = require("./services/discordService");
const { computeAqlPoImpact } = require("./services/aqlAllowanceService");

initializeApp();
const db = getFirestore();

const REGION = "asia-northeast3";
const ADMIN_EMAILS = ["ksmoon@hsvina.com"];

// ─── 유틸리티 ─────────────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRecipients(recipients) {
  var list = Array.isArray(recipients) ? recipients : [recipients];
  var valid = list.filter(isValidEmail);
  if (valid.length === 0) {
    throw new HttpsError("invalid-argument", "유효한 수신자가 없습니다.");
  }
  return valid;
}

async function getSmtpConfig() {
  var smtpUser = process.env.SMTP_USER;
  var smtpPassword = process.env.SMTP_PASSWORD;

  if (!smtpUser || !smtpPassword) {
    var configDoc = await db.collection("config").doc("email").get();
    if (configDoc.exists) {
      var config = configDoc.data();
      smtpUser = config.gmailUser;
      smtpPassword = config.gmailAppPassword;
    }
  }

  if (!smtpUser || !smtpPassword) {
    throw new Error("SMTP 자격증명이 설정되지 않았습니다.");
  }

  return { smtpUser, smtpPassword };
}

async function getAdminEmails() {
  try {
    var configDoc = await db.collection("system").doc("config").get();
    if (configDoc.exists && configDoc.data().admin_emails) {
      return configDoc.data().admin_emails;
    }
  } catch (err) {
    logger.warn("Admin 이메일 로드 실패, 기본값 사용:", err.message);
  }
  return ADMIN_EMAILS;
}

function verifyAdmin(context) {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }
  var email = context.auth.token.email;
  if (!ADMIN_EMAILS.includes(email)) {
    throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  }
}

// ─── 1. 새 피드백 생성 시 관리자 알림 ──────────────────────

exports.onSystemFeedbackCreated = onDocumentCreated(
  {
    document: "system_feedback/{docId}",
    region: REGION,
  },
  async (event) => {
    var snapshot = event.data;
    if (!snapshot) return;

    var feedback = snapshot.data();
    var docId = event.params.docId;

    logger.info("새 피드백 접수:", {
      docId: docId,
      type: feedback.type,
      priority: feedback.priority,
      title: feedback.title,
    });

    try {
      var smtp = await getSmtpConfig();
      var adminEmails = await getAdminEmails();
      var recipients = validateRecipients(adminEmails);

      var html = buildNewFeedbackEmail(feedback);
      var priorityTag =
        feedback.priority === "critical" ? "[긴급] " : "";

      var result = await sendEmail(smtp.smtpUser, smtp.smtpPassword, {
        to: recipients,
        subject:
          priorityTag +
          "[QIP Incentive] 새 피드백: " +
          (feedback.title || "제목 없음"),
        html: html,
      });

      logger.info("피드백 알림 이메일 전송 성공:", {
        docId: docId,
        messageId: result.messageId,
        recipientCount: recipients.length,
      });

      // 이메일 발송 로그
      await db.collection("email_logs").add({
        type: "feedback_notification",
        feedbackId: docId,
        to: recipients,
        messageId: result.messageId,
        sentAt: new Date().toISOString(),
        status: "sent",
      });
    } catch (err) {
      logger.error("피드백 알림 이메일 전송 실패:", {
        docId: docId,
        error: err.message,
        stack: err.stack,
      });
    }
  }
);

// ─── 2. 피드백 상태 변경 시 작성자 알림 ──────────────────

exports.onFeedbackStatusUpdated = onDocumentUpdated(
  {
    document: "system_feedback/{docId}",
    region: REGION,
  },
  async (event) => {
    var before = event.data.before.data();
    var after = event.data.after.data();
    var docId = event.params.docId;

    // 상태가 변경된 경우에만 처리
    if (before.status === after.status) return;

    // 수신자 목록: notificationEmails > reporterEmail > createdBy.email
    var recipients = [];
    if (after.notificationEmails && Array.isArray(after.notificationEmails) && after.notificationEmails.length > 0) {
      recipients = after.notificationEmails.filter(isValidEmail);
    } else {
      var reporterEmail = after.reporterEmail || after.createdBy?.email;
      if (reporterEmail && isValidEmail(reporterEmail)) {
        recipients = [reporterEmail];
      }
    }

    if (recipients.length === 0) {
      logger.warn("피드백 알림 수신자 없음:", { docId: docId });
      return;
    }

    logger.info("피드백 상태 변경:", {
      docId: docId,
      from: before.status,
      to: after.status,
      recipients: recipients,
    });

    try {
      var smtp = await getSmtpConfig();
      var html = buildStatusChangeEmail(after, after.status);

      for (var recipient of recipients) {
        var result = await sendEmail(smtp.smtpUser, smtp.smtpPassword, {
          to: recipient,
          subject:
            "[QIP Incentive] 피드백 상태 변경: " +
            (after.title || "제목 없음"),
          html: html,
        });

        logger.info("상태 변경 알림 전송 성공:", {
          docId: docId,
          to: recipient,
          messageId: result.messageId,
        });

        await db.collection("email_logs").add({
          type: "feedback_status_change",
          feedbackId: docId,
          to: recipient,
          oldStatus: before.status,
          newStatus: after.status,
          messageId: result.messageId,
          sentAt: new Date().toISOString(),
          status: "sent",
        });
      }
    } catch (err) {
      logger.error("상태 변경 알림 전송 실패:", {
        docId: docId,
        error: err.message,
        stack: err.stack,
      });
    }
  }
);

// ─── 3. 피드백 답변 발송 (관리자 전용) ──────────────────

exports.sendFeedbackReply = onCall(
  {
    region: REGION,
    timeoutSeconds: 60,
  },
  async (request) => {
    verifyAdmin(request);

    var data = request.data;
    if (!data.feedbackId || !data.replyText) {
      throw new HttpsError(
        "invalid-argument",
        "feedbackId와 replyText가 필요합니다."
      );
    }

    // 피드백 문서 조회
    var feedbackDoc = await db
      .collection("system_feedback")
      .doc(data.feedbackId)
      .get();
    if (!feedbackDoc.exists) {
      throw new HttpsError("not-found", "피드백을 찾을 수 없습니다.");
    }

    var feedback = feedbackDoc.data();
    var reporterEmail = feedback.reporterEmail || feedback.createdBy?.email;

    if (!reporterEmail || !isValidEmail(reporterEmail)) {
      throw new HttpsError(
        "failed-precondition",
        "작성자 이메일이 유효하지 않습니다."
      );
    }

    try {
      var smtp = await getSmtpConfig();
      var html = buildReplyEmail(feedback, data.replyText);

      var result = await sendEmail(smtp.smtpUser, smtp.smtpPassword, {
        to: reporterEmail,
        subject:
          "[QIP Incentive] 피드백 답변: " +
          (feedback.title || "제목 없음"),
        html: html,
      });

      // 피드백 문서에 답변 기록
      await feedbackDoc.ref.update({
        adminReply: data.replyText,
        repliedAt: new Date().toISOString(),
        repliedBy: request.auth.token.email,
        status: feedback.status === "SUBMITTED" ? "REVIEWING" : feedback.status,
      });

      logger.info("피드백 답변 전송 성공:", {
        feedbackId: data.feedbackId,
        messageId: result.messageId,
        to: reporterEmail,
      });

      await db.collection("email_logs").add({
        type: "feedback_reply",
        feedbackId: data.feedbackId,
        to: reporterEmail,
        messageId: result.messageId,
        sentAt: new Date().toISOString(),
        status: "sent",
      });

      return { success: true, messageId: result.messageId };
    } catch (err) {
      logger.error("피드백 답변 전송 실패:", {
        feedbackId: data.feedbackId,
        error: err.message,
        stack: err.stack,
      });
      throw new HttpsError("internal", "이메일 전송에 실패했습니다.");
    }
  }
);

// ─── 3.5. AQL Reject PO 영향 직원 산출 (관리자 전용) ──────────

exports.computeAqlPoImpact = onCall(
  {
    region: REGION,
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request) => {
    verifyAdmin(request);

    var data = request.data || {};
    var monthYear = data.monthYear;
    var poNumbers = data.poNumbers || [];
    var exemptConditions = data.exemptConditions || ["c5", "c6", "c7", "c8"];

    if (!monthYear || typeof monthYear !== "string") {
      throw new HttpsError("invalid-argument", "monthYear required (e.g. february_2026)");
    }
    if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
      throw new HttpsError("invalid-argument", "poNumbers required (non-empty array)");
    }

    try {
      var result = await computeAqlPoImpact({ monthYear, poNumbers, exemptConditions });
      logger.info("[computeAqlPoImpact] success:", {
        monthYear,
        poCount: poNumbers.length,
        affectedCount: result.autoComputed.affectedEmployees.length,
        elapsedMs: result.meta.elapsedMs,
      });
      return result;
    } catch (err) {
      logger.error("[computeAqlPoImpact] error:", {
        monthYear,
        poNumbers,
        error: err.message,
        stack: err.stack,
      });
      throw new HttpsError("internal", err.message || "AQL PO impact computation failed");
    }
  }
);

// ─── 4. Incentive 월간 성과 이메일 보고서 (매월 1일 12:00 VN) ──

exports.scheduledIncentiveMonthlyEmail = onSchedule(
  {
    schedule: "0 12 1 * *",
    timeZone: "Asia/Ho_Chi_Minh",
    region: REGION,
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async () => {
    logger.info("[Incentive-MonthlyEmail] Starting monthly report");
    try {
      await sendIncentiveMonthlyEmail();
      logger.info("[Incentive-MonthlyEmail] Monthly report completed");
    } catch (error) {
      logger.error("[Incentive-MonthlyEmail] Failed:", error);
    }
  }
);

// ─── 5. Incentive 월간 Discord 보고서 (매월 1일 09:00 VN) ──

exports.scheduledIncentiveMonthlyDiscord = onSchedule(
  {
    schedule: "0 9 1 * *",
    timeZone: "Asia/Ho_Chi_Minh",
    region: REGION,
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async () => {
    logger.info("[Incentive-MonthlyDiscord] Starting monthly Discord report");
    try {
      // Previous month
      const now = new Date();
      const vnNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
      let year = vnNow.getFullYear();
      let month = vnNow.getMonth(); // 0-indexed, so current month index = previous month number
      if (month === 0) { year--; month = 12; }
      const yearMonth = year + "-" + String(month).padStart(2, "0");

      // Previous-previous month for comparison
      let prevYear = year;
      let prevMonth = month - 1;
      if (prevMonth <= 0) { prevYear--; prevMonth += 12; }
      const prevYearMonth = prevYear + "-" + String(prevMonth).padStart(2, "0");

      // Query current month data
      const snapshot = await db
        .collection("incentiveRecords")
        .where("month", "==", yearMonth)
        .get();

      if (snapshot.empty) {
        logger.info("[Incentive-MonthlyDiscord] No data for", yearMonth);
        await sendDiscordMessage(
          `💰 **[Incentive] 월간 보고 (${year}년 ${String(month).padStart(2, "0")}월)**\n━━━━━━━━━━━━━━━━━━\n데이터 없음\n\n_Incentive • 자동 보고서_`
        );
        return;
      }

      // Aggregate
      let totalScore = 0;
      let count = 0;
      const lines = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const quality = data.qualityScore || data.quality || 0;
        const productivity = data.productivityScore || data.productivity || 0;
        const attendance = data.attendanceScore || data.attendance || 0;
        const total = data.totalScore || (quality + productivity + attendance);
        const building = data.building || data.factory || "";
        const line = data.line || data.lineNo || "";

        totalScore += total;
        count++;
        lines.push({ name: building + "-" + line, score: total });
      });

      const avgScore = count > 0 ? (totalScore / count).toFixed(1) : "데이터 없음";

      // Sort for top/bottom
      lines.sort((a, b) => b.score - a.score);
      const topLines = lines
        .slice(0, 3)
        .map((l) => `${l.name} ${l.score.toFixed(1)}점`)
        .join(", ");
      const bottomLines = lines
        .slice(-3)
        .reverse()
        .map((l) => `${l.name} ${l.score.toFixed(1)}점`)
        .join(", ");

      // Previous month comparison
      let deltaStr = "";
      const prevSnap = await db
        .collection("incentiveRecords")
        .where("month", "==", prevYearMonth)
        .get();
      if (!prevSnap.empty) {
        let prevTotal = 0;
        let prevCount = 0;
        prevSnap.forEach((doc) => {
          const data = doc.data();
          prevTotal += data.totalScore || ((data.qualityScore || data.quality || 0) + (data.productivityScore || data.productivity || 0) + (data.attendanceScore || data.attendance || 0));
          prevCount++;
        });
        if (prevCount > 0) {
          const prevAvg = prevTotal / prevCount;
          const delta = (totalScore / count) - prevAvg;
          deltaStr = delta >= 0 ? `▲${delta.toFixed(1)}점` : `▼${Math.abs(delta).toFixed(1)}점`;
        }
      }

      let msg = `💰 **[Incentive] 월간 보고 (${year}년 ${String(month).padStart(2, "0")}월)**\n`;
      msg += `━━━━━━━━━━━━━━━━━━\n`;
      msg += `평균 점수: ${avgScore} | 총 라인: ${count}\n`;
      msg += `상위 라인: ${topLines || "데이터 없음"}\n`;
      msg += `하위 라인: ${bottomLines || "데이터 없음"}\n`;
      if (deltaStr) msg += `전월 대비: ${deltaStr}\n`;

      const timeStr = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false });
      msg += `\n_Incentive • 자동 보고서 • ${timeStr}_`;

      await sendDiscordMessage(msg);
      logger.info("[Incentive-MonthlyDiscord] Monthly Discord report sent");
    } catch (error) {
      logger.error("[Incentive-MonthlyDiscord] Failed:", error);
    }
  }
);
