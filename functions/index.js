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
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { sendEmail } = require("./services/emailService");
const {
  buildNewFeedbackEmail,
  buildReplyEmail,
  buildStatusChangeEmail,
} = require("./templates/feedbackEmail");

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

    var reporterEmail = after.reporterEmail || after.createdBy?.email;
    if (!reporterEmail || !isValidEmail(reporterEmail)) {
      logger.warn("피드백 작성자 이메일 없음:", { docId: docId });
      return;
    }

    logger.info("피드백 상태 변경:", {
      docId: docId,
      from: before.status,
      to: after.status,
    });

    try {
      var smtp = await getSmtpConfig();
      var html = buildStatusChangeEmail(after, after.status);

      var result = await sendEmail(smtp.smtpUser, smtp.smtpPassword, {
        to: reporterEmail,
        subject:
          "[QIP Incentive] 피드백 상태 변경: " +
          (after.title || "제목 없음"),
        html: html,
      });

      logger.info("상태 변경 알림 전송 성공:", {
        docId: docId,
        messageId: result.messageId,
      });

      await db.collection("email_logs").add({
        type: "feedback_status_change",
        feedbackId: docId,
        to: reporterEmail,
        oldStatus: before.status,
        newStatus: after.status,
        messageId: result.messageId,
        sentAt: new Date().toISOString(),
        status: "sent",
      });
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
