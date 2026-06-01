/**
 * Incentive 월간 성과 이메일 보고서
 *
 * 매월 1일 12:00 VN 발송
 * 데이터 소스: dashboard_summary/{monthname}_{year} 문서
 *   (예: april_2026) — 실데이터가 존재하는 SSOT.
 *
 * 결함 D2 (보스 발견): 기존에는 죽은 컬렉션 incentiveRecords(empty)를 읽어
 *   매월 snapshot.empty=true → 영구 미발송(skip). 실데이터는
 *   dashboard_summary/{monthname}_{year} 에 존재하므로 소스를 교체.
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

function fmtMoney(n) {
  if (n == null || isNaN(n)) return "-";
  return Number(n).toLocaleString("vi-VN") + " VND";
}

/**
 * 수령률(%) 표시 — S1 분모0 착시 가드.
 * 분모(denom)<=0 이면 0.00% 양호로 표시하지 않고 'N/A (대상 0명)' 로 치환.
 * 분자/분모를 항상 병기한다.
 */
function fmtRate(num, denom) {
  if (denom == null || denom <= 0) {
    return "N/A (대상 0명)";
  }
  var rate = (num / denom) * 100;
  return rate.toFixed(1) + "% (" + fmt(num) + "/" + fmt(denom) + ")";
}

function rateColor(rate) {
  if (rate == null) return GRAY;
  if (rate >= 85) return GREEN;
  if (rate >= 70) return AMBER;
  return RED;
}

function scoreColor(score) {
  if (score >= 80) return GREEN;
  if (score >= 60) return AMBER;
  return RED;
}

// ---------------------------------------------------------------------------
// Data Collection
// ---------------------------------------------------------------------------

// Lowercase month names — dashboard_summary 문서 ID 규칙: {monthname}_{year}
// (예: april_2026). upload_to_firestore.py 가 동일 규칙으로 기록한다.
var MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * dashboard_summary 문서 ID ({monthname}_{year}) 반환.
 * monthsBack: 0 = 직전 달(보고 대상), 1 = 두 달 전(비교용).
 */
function getSummaryDocId(monthsBack) {
  var now = new Date();
  // Vietnam is UTC+7
  var vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  // getUTCMonth() 는 0-indexed 이므로, "직전 달"은 (현재월 - 1).
  // 0-indexed 누적값으로 계산: 현재월 인덱스 - 1(직전) - monthsBack.
  var idx = vnNow.getUTCFullYear() * 12 + (vnNow.getUTCMonth() - 1 - monthsBack);
  var year = Math.floor(idx / 12);
  var monthIdx = ((idx % 12) + 12) % 12; // 0..11
  return MONTH_NAMES[monthIdx] + "_" + year;
}

/** 표시용 라벨 (예: "April 2026"). */
function docIdToLabel(docId) {
  var parts = String(docId).split("_");
  var m = parts[0] || "";
  var y = parts[1] || "";
  return (m.charAt(0).toUpperCase() + m.slice(1)) + " " + y;
}

/**
 * Collect incentive data for a given dashboard_summary doc.
 *
 * 결함 D2: 죽은 incentiveRecords 대신 dashboard_summary/{docId} 를 읽는다.
 * 반환 구조는 formatIncentiveMonthlyEmail 이 사용하는 정규화 형태.
 */
async function collectMonthData(db, docId) {
  var snap = await db.collection("dashboard_summary").doc(docId).get();
  if (!snap.exists) {
    return null;
  }

  var d = snap.data() || {};

  var totalEmployees = Number(d.total_employees || 0);
  var eligibleEmployees = Number(d.eligible_employees || totalEmployees || 0);
  var receivingEmployees = Number(d.receiving_employees || 0);
  var totalIncentive = Number(d.total_incentive || 0);
  // payment_rate 는 upload 파이프라인이 기록 (receiving/total*100). 없으면 계산.
  var paymentRate = (d.payment_rate != null)
    ? Number(d.payment_rate)
    : (totalEmployees > 0 ? (receivingEmployees / totalEmployees) * 100 : 0);

  // Building breakdown → 수령률/지급액 기준 정렬용 배열
  var buildingBreakdown = d.building_breakdown || {};
  var buildings = Object.keys(buildingBreakdown).map(function (name) {
    var b = buildingBreakdown[name] || {};
    var count = Number(b.count || 0);
    var receiving = Number(b.receiving || 0);
    var amount = Number(b.total_amount || 0);
    return {
      name: name,
      count: count,
      receiving: receiving,
      amount: amount,
      // 결함 S1 가드: 분모(count)<=0 이면 비율을 0% 양호로 표시하지 않고 null 처리.
      rate: count > 0 ? (receiving / count) * 100 : null,
    };
  });

  // Type breakdown 그대로 보존 (TYPE-1/2/3)
  var typeBreakdown = d.type_breakdown || {};

  return {
    docId: docId,
    monthLabel: docIdToLabel(docId),
    totalEmployees: totalEmployees,
    eligibleEmployees: eligibleEmployees,
    receivingEmployees: receivingEmployees,
    totalIncentive: totalIncentive,
    paymentRate: paymentRate,
    workingDays: Number(d.working_days || 0),
    buildings: buildings,
    typeBreakdown: typeBreakdown,
    conditionStats: d.condition_stats || {},
  };
}

// ---------------------------------------------------------------------------
// Email Formatter
// ---------------------------------------------------------------------------

function formatIncentiveMonthlyEmail(current, previous) {
  // KPI cards — dashboard_summary 기반.
  // 자격/전체 카드: 분모(total)<=0 이면 비율 대신 'N/A' (S1 가드).
  var eligibleValue = current.totalEmployees > 0
    ? fmt(current.eligibleEmployees) + " / " + fmt(current.totalEmployees)
    : "-";
  var payRateValue = current.totalEmployees > 0
    ? current.paymentRate.toFixed(1) + "%"
    : "N/A";
  var kpis = kpiCardRow([
    { label: "Payment Rate", value: payRateValue, color: rateColor(current.totalEmployees > 0 ? current.paymentRate : null) },
    { label: "Receiving", value: fmt(current.receivingEmployees) },
    { label: "Eligible / Total", value: eligibleValue, color: BLUE },
    { label: "Total Incentive", value: fmtMoney(current.totalIncentive), color: AMBER },
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
          ["Payment Rate (%)", current.paymentRate.toFixed(1), previous.paymentRate.toFixed(1), delta(current.paymentRate, previous.paymentRate)],
          ["Receiving Employees", fmt(current.receivingEmployees), fmt(previous.receivingEmployees), delta(current.receivingEmployees, previous.receivingEmployees)],
          ["Total Employees", fmt(current.totalEmployees), fmt(previous.totalEmployees), delta(current.totalEmployees, previous.totalEmployees)],
          ["Total Incentive (VND)", fmt(current.totalIncentive), fmt(previous.totalIncentive), delta(current.totalIncentive, previous.totalIncentive)],
        ],
        { headerBg: BLUE }
      );
  }

  // Type breakdown (TYPE-1/2/3) — 수령/전체 항상 병기, 분모0 가드.
  var typeKeys = Object.keys(current.typeBreakdown || {}).sort();
  var typeSection = "";
  if (typeKeys.length > 0) {
    typeSection =
      sectionHeading("Incentive by TYPE") +
      dataTable(
        ["TYPE", "Receiving / Total", "Pay Rate", "Total (VND)"],
        typeKeys.map(function (k) {
          var t = current.typeBreakdown[k] || {};
          var count = Number(t.count || 0);
          var receiving = Number(t.receiving || 0);
          var rate = count > 0 ? (receiving / count) * 100 : null;
          var rateCell = (rate == null)
            ? `<span style="color:${GRAY};">N/A (0)</span>`
            : `<span style="color:${rateColor(rate)};font-weight:bold;">${rate.toFixed(1)}%</span>`;
          return [
            k,
            fmt(receiving) + " / " + fmt(count),
            rateCell,
            fmtMoney(Number(t.total_amount || 0)),
          ];
        }),
        { headerBg: BLUE }
      );
  }

  // Top 5 buildings by total incentive amount
  var buildings = (current.buildings || []).slice();
  var topBuildings = buildings
    .filter(function (b) { return b.count >= 5; })
    .sort(function (a, b) { return b.amount - a.amount; })
    .slice(0, 5);
  var topSection = "";
  if (topBuildings.length > 0) {
    topSection =
      sectionHeading("Top 5 Buildings (Total Incentive)") +
      dataTable(
        ["#", "Building", "Receiving / Total", "Total (VND)"],
        topBuildings.map(function (b, i) {
          return [
            String(i + 1),
            b.name,
            fmt(b.receiving) + " / " + fmt(b.count),
            fmtMoney(b.amount),
          ];
        })
      );
  }

  // Bottom 5 buildings by payment rate (5+ employees) — 분모0 가드로
  // rate=null 인 building 은 제외(0% 착시 방지).
  var bottomBuildings = buildings
    .filter(function (b) { return b.count >= 5 && b.rate != null; })
    .sort(function (a, b) { return a.rate - b.rate; })
    .slice(0, 5);
  var bottomSection = "";
  if (bottomBuildings.length > 0) {
    bottomSection =
      sectionHeading("Bottom 5 Buildings — Lowest Pay Rate (Needs Attention)") +
      dataTable(
        ["#", "Building", "Receiving / Total", "Pay Rate"],
        bottomBuildings.map(function (b, i) {
          return [
            String(i + 1),
            b.name,
            fmt(b.receiving) + " / " + fmt(b.count),
            `<span style="color:${rateColor(b.rate)};font-weight:bold;">${b.rate.toFixed(1)}%</span>`,
          ];
        }),
        { headerBg: "#b91c1c" }
      );
  }

  // Action items
  var actionRows = [];

  if (previous && current.paymentRate < previous.paymentRate - 1) {
    actionRows.push(
      alertItem(
        "warning",
        "Payment rate dropped by " +
          (previous.paymentRate - current.paymentRate).toFixed(1) +
          " points vs last month — review contributing factors"
      )
    );
  }

  // TYPE-3 전원 미수령 경고 (자격 조건 점검)
  var t3 = (current.typeBreakdown || {})["TYPE-3"];
  if (t3 && Number(t3.count || 0) > 0 && Number(t3.receiving || 0) === 0) {
    actionRows.push(
      alertItem(
        "critical",
        "TYPE-3 (" + fmt(Number(t3.count)) + "명) 전원 미수령 — 자격 조건 점검 필요"
      )
    );
  }

  // 수령률 낮은 부서 (5명+, rate 측정 가능한 것만)
  var lowBuildings = buildings.filter(function (b) {
    return b.count >= 10 && b.rate != null && b.rate < 60;
  });
  if (lowBuildings.length > 0) {
    actionRows.push(
      alertItem(
        "warning",
        lowBuildings.length + "개 부서 수령률 60% 미만: " +
          lowBuildings.slice(0, 3).map(function (b) {
            return b.name + " (" + b.rate.toFixed(0) + "%)";
          }).join(", ") +
          (lowBuildings.length > 3 ? " 외" : "") + " — 사유 분석 필요"
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

  var sourceNote =
    `<table role="presentation" width="100%"><tr><td style="padding:8px 0 0;font-size:11px;color:${TEXT_MUTED};">` +
    `Source: dashboard_summary/${current.docId} · ${fmt(current.receivingEmployees)} receiving / ${fmt(current.totalEmployees)} total · ${fmt(current.workingDays)} working days` +
    `</td></tr></table>`;

  var body = [
    kpis,
    spacer(),
    momSection,
    typeSection,
    topSection,
    bottomSection,
    actionSection,
    sourceNote,
  ]
    .filter(Boolean)
    .join("\n");

  return wrapDocument(
    "Incentive Monthly Performance Report",
    current.monthLabel,
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
  // 결함 D2: dashboard_summary 문서 ID ({monthname}_{year}) 로 조회.
  var targetMonth = getSummaryDocId(0);     // 직전 달 (보고 대상)
  var comparisonMonth = getSummaryDocId(1); // 두 달 전 (비교용)

  logger.info("[Incentive-Email] Target doc: " + targetMonth + ", Comparison: " + comparisonMonth);

  // Collect data for both months (dashboard_summary 기반)
  var current = await collectMonthData(db, targetMonth);

  if (!current || current.totalEmployees === 0) {
    logger.warn("[Incentive-Email] No dashboard_summary data for " + targetMonth + ". Skipping email.");
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
    subject: "[Incentive] Monthly Performance Report \u2014 " + current.monthLabel,
    html: html,
  });

  logger.info("[Incentive-Email] Monthly email sent to " + recipients.join(", ") + ", messageId: " + result.messageId);
}

module.exports = { sendIncentiveMonthlyEmail };
