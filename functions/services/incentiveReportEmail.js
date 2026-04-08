/**
 * Incentive 월간 성과 이메일 보고서
 *
 * 매월 1일 12:00 VN 발송
 * 데이터 소스: incentiveRecords 컬렉션
 *
 * Design: navy header, table-based, inline CSS (Gmail/Outlook 호환)
 */

const { logger } = require("firebase-functions");
const { getFirestore } = require("firebase-admin/firestore");
const { sendEmail } = require("./emailService");

// ---------------------------------------------------------------------------
// Brand tokens
// ---------------------------------------------------------------------------

const NAVY = "#1e3a5f";
const BLUE = "#3b82f6";
const LIGHT_BG = "#f0f4f8";
const WHITE = "#ffffff";
const BORDER = "#d1d5db";
const TEXT_DARK = "#1f2937";
const TEXT_MUTED = "#6b7280";
const RED = "#dc2626";
const AMBER = "#d97706";
const GREEN = "#16a34a";
const GRAY = "#9ca3af";

const DASHBOARD_URL = "https://hwk-qip-incentive-dashboard.web.app";

// ---------------------------------------------------------------------------
// HTML building blocks
// ---------------------------------------------------------------------------

function wrapDocument(title, dateLabel, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${LIGHT_BG};font-family:Arial,Helvetica,sans-serif;color:${TEXT_DARK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};">
  <tr><td align="center" style="padding:24px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${WHITE};border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <!-- Header -->
      <tr>
        <td style="background:${NAVY};padding:24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:${WHITE};font-size:24px;font-weight:bold;letter-spacing:0.5px;">INCENTIVE</td>
              <td align="right" style="color:rgba(255,255,255,0.85);font-size:14px;">${dateLabel}</td>
            </tr>
            <tr>
              <td colspan="2" style="color:rgba(255,255,255,0.7);font-size:13px;padding-top:4px;">${title}</td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:24px 32px;">
${body}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:${LIGHT_BG};padding:16px 32px;border-top:1px solid ${BORDER};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:${TEXT_MUTED};font-size:11px;">This is an automated report from HWK QIP Incentive System.</td>
              <td align="right"><a href="${DASHBOARD_URL}" style="color:${BLUE};font-size:12px;text-decoration:none;">Open Dashboard &rarr;</a></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function kpiCardRow(cards) {
  var cellWidth = Math.floor(100 / cards.length);
  var cells = cards
    .map(function (c) {
      var valueColor = String(c.value) === "-" ? GRAY : (c.color || NAVY);
      return `<td width="${cellWidth}%" style="padding:4px;text-align:center;vertical-align:top;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};border-radius:6px;border:1px solid ${BORDER};">
          <tr><td style="padding:10px 6px 2px;font-size:10px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.5px;">${c.label}</td></tr>
          <tr><td style="padding:0 6px 10px;font-size:20px;font-weight:bold;color:${valueColor};">${c.value}</td></tr>
        </table>
      </td>`;
    })
    .join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`;
}

function sectionHeading(text) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 10px;">
  <tr>
    <td style="border-bottom:3px solid ${BLUE};padding-bottom:6px;font-size:15px;font-weight:bold;color:${NAVY};">${text}</td>
  </tr>
</table>`;
}

function dataTable(headers, rows, opts) {
  var hBg = (opts && opts.headerBg) || NAVY;
  var zebra = "#f9fafb";
  var ths = headers
    .map(function (h) {
      return `<th style="padding:8px 10px;text-align:left;color:${WHITE};font-size:12px;font-weight:600;white-space:nowrap;">${h}</th>`;
    })
    .join("");
  var trs = rows
    .map(function (row, i) {
      var cells = row
        .map(function (cell) {
          return `<td style="padding:8px 10px;font-size:13px;border-bottom:1px solid ${BORDER};">${cell}</td>`;
        })
        .join("");
      return `<tr style="background:${i % 2 === 0 ? WHITE : zebra};">${cells}</tr>`;
    })
    .join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${BORDER};border-radius:4px;overflow:hidden;">
  <tr style="background:${hBg};">${ths}</tr>
  ${trs}
</table>`;
}

function alertItem(level, text) {
  var colorMap = { critical: RED, warning: AMBER, info: BLUE };
  return `<tr>
  <td style="padding:8px 12px;border-left:4px solid ${colorMap[level]};background:${LIGHT_BG};font-size:13px;">${text}</td>
</tr>
<tr><td style="height:4px;"></td></tr>`;
}

function spacer(h) {
  return `<table role="presentation" width="100%"><tr><td style="height:${h || 12}px;"></td></tr></table>`;
}

function fmt(n) {
  if (n == null || isNaN(n)) return "-";
  return Number(n).toLocaleString("en-US");
}

function scoreColor(score) {
  if (score >= 80) return GREEN;
  if (score >= 60) return AMBER;
  return RED;
}

// ---------------------------------------------------------------------------
// Data Collection
// ---------------------------------------------------------------------------

/**
 * Get YYYY-MM for the previous month (in VN timezone).
 */
function getPreviousMonth() {
  var now = new Date();
  // Vietnam is UTC+7
  var vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  var year = vnNow.getUTCFullYear();
  var month = vnNow.getUTCMonth(); // 0-indexed, so this is already "previous month"
  if (month === 0) {
    year--;
    month = 12;
  }
  return year + "-" + String(month).padStart(2, "0");
}

/**
 * Get YYYY-MM for two months ago (for comparison).
 */
function getTwoMonthsAgo() {
  var now = new Date();
  var vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  var year = vnNow.getUTCFullYear();
  var month = vnNow.getUTCMonth() - 1;
  if (month <= 0) {
    year--;
    month = month + 12;
  }
  return year + "-" + String(month).padStart(2, "0");
}

/**
 * Collect incentive data for a given month.
 */
async function collectMonthData(db, yearMonth) {
  var snapshot = await db
    .collection("incentiveRecords")
    .where("month", "==", yearMonth)
    .get();

  if (snapshot.empty) {
    return null;
  }

  var totalScore = 0;
  var totalQuality = 0;
  var totalProductivity = 0;
  var totalAttendance = 0;
  var count = 0;
  var lines = [];

  snapshot.forEach(function (doc) {
    var data = doc.data();
    var quality = data.qualityScore || data.quality || 0;
    var productivity = data.productivityScore || data.productivity || 0;
    var attendance = data.attendanceScore || data.attendance || 0;
    var total = data.totalScore || (quality + productivity + attendance);
    var building = data.building || data.factory || "";
    var line = data.line || data.lineNo || "";

    totalScore += total;
    totalQuality += quality;
    totalProductivity += productivity;
    totalAttendance += attendance;
    count++;

    lines.push({
      name: building + "-" + line,
      building: building,
      line: line,
      score: total,
      quality: quality,
      productivity: productivity,
      attendance: attendance,
    });
  });

  lines.sort(function (a, b) { return b.score - a.score; });

  return {
    month: yearMonth,
    totalLines: count,
    avgScore: count > 0 ? Math.round((totalScore / count) * 100) / 100 : 0,
    avgQuality: count > 0 ? Math.round((totalQuality / count) * 100) / 100 : 0,
    avgProductivity: count > 0 ? Math.round((totalProductivity / count) * 100) / 100 : 0,
    avgAttendance: count > 0 ? Math.round((totalAttendance / count) * 100) / 100 : 0,
    topLines: lines.slice(0, 5),
    bottomLines: lines.slice(-Math.min(5, lines.length)).reverse(),
    allLines: lines,
  };
}

// ---------------------------------------------------------------------------
// Email Formatter
// ---------------------------------------------------------------------------

function formatIncentiveMonthlyEmail(current, previous) {
  // KPI cards
  var kpis = kpiCardRow([
    { label: "Avg Score", value: fmt(current.avgScore), color: scoreColor(current.avgScore) },
    { label: "Total Lines", value: fmt(current.totalLines) },
    { label: "Avg Quality", value: fmt(current.avgQuality), color: scoreColor(current.avgQuality) },
    { label: "Avg Productivity", value: fmt(current.avgProductivity), color: scoreColor(current.avgProductivity) },
  ]);

  // Month-over-month comparison
  var momSection = "";
  if (previous) {
    function delta(curr, prev) {
      var diff = curr - prev;
      if (Math.abs(diff) < 0.01) return `<span style="color:${TEXT_MUTED};font-size:11px;">no change</span>`;
      var arrow = diff > 0 ? "&#9650;" : "&#9660;";
      var color = diff > 0 ? GREEN : RED;
      return `<span style="color:${color};font-size:11px;">${arrow} ${Math.abs(diff).toFixed(1)}</span>`;
    }

    momSection =
      sectionHeading("Month-over-Month Comparison") +
      dataTable(
        ["Metric", "Current", "Previous", "Change"],
        [
          ["Avg Score", fmt(current.avgScore), fmt(previous.avgScore), delta(current.avgScore, previous.avgScore)],
          ["Total Lines", fmt(current.totalLines), fmt(previous.totalLines), delta(current.totalLines, previous.totalLines)],
          ["Avg Quality", fmt(current.avgQuality), fmt(previous.avgQuality), delta(current.avgQuality, previous.avgQuality)],
          ["Avg Productivity", fmt(current.avgProductivity), fmt(previous.avgProductivity), delta(current.avgProductivity, previous.avgProductivity)],
          ["Avg Attendance", fmt(current.avgAttendance), fmt(previous.avgAttendance), delta(current.avgAttendance, previous.avgAttendance)],
        ],
        { headerBg: BLUE }
      );
  }

  // Top 5 performing lines
  var topSection = "";
  if (current.topLines.length > 0) {
    topSection =
      sectionHeading("Top 5 Performing Lines") +
      dataTable(
        ["#", "Line", "Building", "Score"],
        current.topLines.map(function (l, i) {
          return [
            String(i + 1),
            l.name,
            l.building,
            `<span style="color:${scoreColor(l.score)};font-weight:bold;">${fmt(l.score)}</span>`,
          ];
        })
      );
  }

  // Bottom 5 lines (needs attention)
  var bottomSection = "";
  if (current.bottomLines.length > 0) {
    bottomSection =
      sectionHeading("Bottom 5 Lines (Needs Attention)") +
      dataTable(
        ["#", "Line", "Building", "Score"],
        current.bottomLines.map(function (l, i) {
          return [
            String(i + 1),
            l.name,
            l.building,
            `<span style="color:${scoreColor(l.score)};font-weight:bold;">${fmt(l.score)}</span>`,
          ];
        }),
        { headerBg: "#b91c1c" }
      );
  }

  // Action items
  var actionRows = [];

  if (previous && current.avgScore < previous.avgScore - 1) {
    actionRows.push(
      alertItem(
        "warning",
        "Average score dropped by " +
          (previous.avgScore - current.avgScore).toFixed(1) +
          " points vs last month — review contributing factors"
      )
    );
  }

  // Check if bottom lines are unchanged for 2+ months (compare names)
  if (previous) {
    var prevBottomNames = previous.bottomLines.map(function (l) { return l.name; });
    var repeatBottomLines = current.bottomLines.filter(function (l) {
      return prevBottomNames.includes(l.name);
    });
    if (repeatBottomLines.length >= 2) {
      actionRows.push(
        alertItem(
          "critical",
          repeatBottomLines.length +
            " line(s) remain in bottom 5 for 2+ months: " +
            repeatBottomLines.map(function (l) { return l.name; }).join(", ") +
            " — recommend intervention"
        )
      );
    }
  }

  // Lines below threshold
  var belowThreshold = current.allLines.filter(function (l) { return l.score < 50; });
  if (belowThreshold.length > 0) {
    actionRows.push(
      alertItem(
        "warning",
        belowThreshold.length + " line(s) scored below 50 — immediate attention required"
      )
    );
  }

  if (actionRows.length === 0) {
    actionRows.push(
      alertItem("info", "All metrics within acceptable range. No action required.")
    );
  }

  var actionSection =
    sectionHeading("Action Items") +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${actionRows.join("")}</table>`;

  var body = [
    kpis,
    spacer(),
    momSection,
    topSection,
    bottomSection,
    actionSection,
  ]
    .filter(Boolean)
    .join("\n");

  return wrapDocument(
    "Incentive Monthly Performance Report",
    current.month,
    body
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Collect incentive data and send monthly email report.
 * Called from the scheduled function in index.js.
 */
async function sendIncentiveMonthlyEmail() {
  logger.info("[Incentive-Email] Starting monthly email report");

  var db = getFirestore();
  var targetMonth = getPreviousMonth();
  var comparisonMonth = getTwoMonthsAgo();

  logger.info("[Incentive-Email] Target month: " + targetMonth + ", Comparison: " + comparisonMonth);

  // Collect data for both months
  var current = await collectMonthData(db, targetMonth);

  if (!current || current.totalLines === 0) {
    logger.warn("[Incentive-Email] No incentive records for " + targetMonth + ". Skipping email.");
    return;
  }

  var previous = await collectMonthData(db, comparisonMonth);

  // Format HTML
  var html = formatIncentiveMonthlyEmail(current, previous);

  // Get SMTP config
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
    // Try SMTP settings from QOS push
    var smtpDoc = await db.collection("config").doc("smtp_settings").get();
    if (smtpDoc.exists) {
      var smtpConfig = smtpDoc.data();
      smtpUser = smtpConfig.user;
      smtpPassword = smtpConfig.pass;
    }
  }

  if (!smtpUser || !smtpPassword) {
    throw new Error("[Incentive-Email] SMTP credentials not found");
  }

  // Determine recipients
  var recipients = ["ksmoon@hsvina.com"];
  try {
    var emailConfig = await db.collection("config").doc("email_recipients").get();
    if (emailConfig.exists) {
      var data = emailConfig.data();
      if (data && data.report_recipients && Array.isArray(data.report_recipients)) {
        var filtered = data.report_recipients.filter(function (e) {
          return typeof e === "string" && e.includes("@");
        });
        if (filtered.length > 0) {
          recipients = filtered;
        }
      }
    }
  } catch (err) {
    logger.warn("[Incentive-Email] Failed to read email config, using default:", err.message);
  }

  // Send
  var result = await sendEmail(smtpUser, smtpPassword, {
    to: recipients,
    subject: "[Incentive] Monthly Performance Report \u2014 " + targetMonth,
    html: html,
  });

  logger.info("[Incentive-Email] Monthly email sent to " + recipients.join(", ") + ", messageId: " + result.messageId);
}

module.exports = { sendIncentiveMonthlyEmail };
