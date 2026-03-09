/**
 * Feedback Email Templates (3개 국어)
 * HWK QIP Incentive System V10
 *
 * 초등학교 수준의 쉬운 언어로 작성
 */

const PRIORITY_COLORS = {
  critical: "#dc3545",
  high: "#fd7e14",
  medium: "#ffc107",
  low: "#28a745",
};

const TYPE_LABELS = {
  BUG: { ko: "버그", en: "Bug", vi: "Lỗi" },
  IMPROVEMENT: { ko: "개선", en: "Improvement", vi: "Cải thiện" },
  NEW_FEATURE: { ko: "새 기능", en: "New Feature", vi: "Tính năng mới" },
  UI_UX: { ko: "화면/디자인", en: "UI/UX", vi: "Giao diện" },
  DATA: { ko: "데이터", en: "Data", vi: "Dữ liệu" },
  OTHER: { ko: "기타", en: "Other", vi: "Khác" },
};

const PRIORITY_LABELS = {
  critical: { ko: "긴급", en: "Critical", vi: "Khẩn cấp" },
  high: { ko: "높음", en: "High", vi: "Cao" },
  medium: { ko: "보통", en: "Medium", vi: "Trung bình" },
  low: { ko: "낮음", en: "Low", vi: "Thấp" },
};

const STATUS_LABELS = {
  SUBMITTED: { ko: "접수됨", en: "Submitted", vi: "Đã gửi" },
  REVIEWING: { ko: "검토 중", en: "Reviewing", vi: "Đang xem xét" },
  IN_PROGRESS: { ko: "진행 중", en: "In Progress", vi: "Đang xử lý" },
  COMPLETED: { ko: "완료", en: "Completed", vi: "Hoàn thành" },
  REJECTED: { ko: "반려", en: "Rejected", vi: "Từ chối" },
};

function baseStyle() {
  return `
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f7fa; }
    .container { max-width: 650px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a237e, #3949ab); color: #fff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; }
    .section { padding: 20px 24px; }
    .lang { display: inline-block; background: #e8eaf6; color: #1a237e; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-bottom: 6px; }
    .info-box { background: #f8f9fa; border-left: 4px solid #1a237e; padding: 12px 16px; border-radius: 6px; margin: 8px 0; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; color: #fff; }
    .footer { background: #f5f7fa; padding: 16px 24px; text-align: center; color: #666; font-size: 11px; }
    p { line-height: 1.6; margin: 4px 0; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    td { padding: 6px 12px; border: 1px solid #e0e0e0; font-size: 13px; }
    td:first-child { background: #f5f7fa; font-weight: bold; width: 120px; }
  `;
}

/**
 * 새 피드백 알림 (관리자용)
 */
function buildNewFeedbackEmail(feedback) {
  var type = TYPE_LABELS[feedback.type] || TYPE_LABELS.OTHER;
  var priority = PRIORITY_LABELS[feedback.priority] || PRIORITY_LABELS.medium;
  var pColor = PRIORITY_COLORS[feedback.priority] || "#ffc107";
  var reporter = feedback.reporterEmail || feedback.createdBy?.email || "unknown";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyle()}</style></head><body>
<div class="container">
  <div class="header">
    <h1>QIP Incentive - 새 피드백 접수</h1>
    <p style="opacity:0.85;font-size:13px;">New Feedback Received | Phản hồi mới</p>
  </div>

  <div class="section">
    <span class="lang">🇰🇷 한국어</span>
    <p>새로운 피드백이 접수되었어요!</p>
    <table>
      <tr><td>유형</td><td>${type.ko}</td></tr>
      <tr><td>우선순위</td><td><span class="badge" style="background:${pColor}">${priority.ko}</span></td></tr>
      <tr><td>제목</td><td><strong>${escapeHtml(feedback.title)}</strong></td></tr>
      <tr><td>작성자</td><td>${escapeHtml(reporter)}</td></tr>
    </table>
    <div class="info-box"><strong>내용:</strong><br>${escapeHtml(feedback.description || "")}</div>
  </div>

  <div class="section">
    <span class="lang" style="background:#e3f2fd;color:#0d47a1;">🇬🇧 English</span>
    <p>A new feedback has been submitted!</p>
    <table>
      <tr><td>Type</td><td>${type.en}</td></tr>
      <tr><td>Priority</td><td><span class="badge" style="background:${pColor}">${priority.en}</span></td></tr>
      <tr><td>Title</td><td><strong>${escapeHtml(feedback.title)}</strong></td></tr>
      <tr><td>Reporter</td><td>${escapeHtml(reporter)}</td></tr>
    </table>
    <div class="info-box"><strong>Description:</strong><br>${escapeHtml(feedback.description || "")}</div>
  </div>

  <div class="section">
    <span class="lang" style="background:#fff3e0;color:#e65100;">🇻🇳 Tiếng Việt</span>
    <p>Một phản hồi mới đã được gửi!</p>
    <table>
      <tr><td>Loại</td><td>${type.vi}</td></tr>
      <tr><td>Ưu tiên</td><td><span class="badge" style="background:${pColor}">${priority.vi}</span></td></tr>
      <tr><td>Tiêu đề</td><td><strong>${escapeHtml(feedback.title)}</strong></td></tr>
      <tr><td>Người gửi</td><td>${escapeHtml(reporter)}</td></tr>
    </table>
    <div class="info-box"><strong>Nội dung:</strong><br>${escapeHtml(feedback.description || "")}</div>
  </div>

  <div class="footer">
    QIP Incentive Dashboard V10 | 관리자 / Admin: ksmoon@hsvina.com
  </div>
</div></body></html>`;
}

/**
 * 피드백 답변 알림 (작성자용)
 */
function buildReplyEmail(feedback, replyText) {
  var type = TYPE_LABELS[feedback.type] || TYPE_LABELS.OTHER;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyle()}</style></head><body>
<div class="container">
  <div class="header">
    <h1>QIP Incentive - 피드백 답변</h1>
    <p style="opacity:0.85;font-size:13px;">Feedback Reply | Trả lời phản hồi</p>
  </div>

  <div class="section">
    <span class="lang">🇰🇷 한국어</span>
    <p>보내주신 피드백에 답변이 왔어요!</p>
    <div class="info-box"><strong>원래 제목:</strong> ${escapeHtml(feedback.title)}<br><strong>유형:</strong> ${type.ko}</div>
    <div class="info-box" style="border-color:#28a745;"><strong>답변:</strong><br>${escapeHtml(replyText)}</div>
  </div>

  <div class="section">
    <span class="lang" style="background:#e3f2fd;color:#0d47a1;">🇬🇧 English</span>
    <p>Your feedback has been replied to!</p>
    <div class="info-box"><strong>Original Title:</strong> ${escapeHtml(feedback.title)}<br><strong>Type:</strong> ${type.en}</div>
    <div class="info-box" style="border-color:#28a745;"><strong>Reply:</strong><br>${escapeHtml(replyText)}</div>
  </div>

  <div class="section">
    <span class="lang" style="background:#fff3e0;color:#e65100;">🇻🇳 Tiếng Việt</span>
    <p>Phản hồi của bạn đã được trả lời!</p>
    <div class="info-box"><strong>Tiêu đề gốc:</strong> ${escapeHtml(feedback.title)}<br><strong>Loại:</strong> ${type.vi}</div>
    <div class="info-box" style="border-color:#28a745;"><strong>Trả lời:</strong><br>${escapeHtml(replyText)}</div>
  </div>

  <div class="footer">
    QIP Incentive Dashboard V10 | 관리자 / Admin: ksmoon@hsvina.com
  </div>
</div></body></html>`;
}

/**
 * 상태 변경 알림 (작성자용)
 */
function buildStatusChangeEmail(feedback, newStatus) {
  var type = TYPE_LABELS[feedback.type] || TYPE_LABELS.OTHER;
  var status = STATUS_LABELS[newStatus] || { ko: newStatus, en: newStatus, vi: newStatus };

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyle()}</style></head><body>
<div class="container">
  <div class="header">
    <h1>QIP Incentive - 피드백 상태 변경</h1>
    <p style="opacity:0.85;font-size:13px;">Status Updated | Cập nhật trạng thái</p>
  </div>

  <div class="section">
    <span class="lang">🇰🇷 한국어</span>
    <p>보내주신 피드백의 상태가 바뀌었어요!</p>
    <table>
      <tr><td>제목</td><td>${escapeHtml(feedback.title)}</td></tr>
      <tr><td>유형</td><td>${type.ko}</td></tr>
      <tr><td>새 상태</td><td><strong>${status.ko}</strong></td></tr>
    </table>
  </div>

  <div class="section">
    <span class="lang" style="background:#e3f2fd;color:#0d47a1;">🇬🇧 English</span>
    <p>The status of your feedback has changed!</p>
    <table>
      <tr><td>Title</td><td>${escapeHtml(feedback.title)}</td></tr>
      <tr><td>Type</td><td>${type.en}</td></tr>
      <tr><td>New Status</td><td><strong>${status.en}</strong></td></tr>
    </table>
  </div>

  <div class="section">
    <span class="lang" style="background:#fff3e0;color:#e65100;">🇻🇳 Tiếng Việt</span>
    <p>Trạng thái phản hồi của bạn đã thay đổi!</p>
    <table>
      <tr><td>Tiêu đề</td><td>${escapeHtml(feedback.title)}</td></tr>
      <tr><td>Loại</td><td>${type.vi}</td></tr>
      <tr><td>Trạng thái mới</td><td><strong>${status.vi}</strong></td></tr>
    </table>
  </div>

  <div class="footer">
    QIP Incentive Dashboard V10 | 관리자 / Admin: ksmoon@hsvina.com
  </div>
</div></body></html>`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  buildNewFeedbackEmail,
  buildReplyEmail,
  buildStatusChangeEmail,
};
