/**
 * Email Service for HWK QIP Incentive System V10
 * 한비로 SMTP 서버 기반 이메일 발송 서비스
 *
 * SMTP: mail.hsvina.com:465 (SSL, 자체서명 인증서)
 * 패턴: HR V2 / OSC 프로젝트와 동일
 */

const nodemailer = require("nodemailer");
const { logger } = require("firebase-functions");

const MAX_RETRIES = 2;

function getBackoffDelay(attempt) {
  return Math.pow(2, attempt) * 1000;
}

/**
 * 이메일 발송 (재시도 포함)
 * @param {string} smtpUser - SMTP 사용자
 * @param {string} smtpPassword - SMTP 비밀번호
 * @param {Object} options - 이메일 옵션
 * @param {string|string[]} options.to - 수신자
 * @param {string} options.subject - 제목
 * @param {string} options.html - HTML 본문
 * @param {string} [options.text] - 평문 (미입력 시 HTML에서 자동 생성)
 * @param {Array} [options.attachments] - 첨부파일
 * @returns {Promise<{messageId: string}>}
 */
async function sendEmail(smtpUser, smtpPassword, options) {
  const transporter = nodemailer.createTransport({
    host: "mail.hsvina.com",
    port: 465,
    secure: true,
    pool: true,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    authMethod: "LOGIN",
    tls: {
      rejectUnauthorized: false,
      minVersion: "TLSv1.2",
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });

  const mailOptions = {
    from: smtpUser,
    to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, ""),
  };

  if (options.attachments) {
    mailOptions.attachments = options.attachments;
  }

  var lastError = null;
  for (var attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      var info = await transporter.sendMail(mailOptions);
      return { messageId: info.messageId };
    } catch (err) {
      lastError = err;
      // 인증 오류는 재시도하지 않음
      if (err.code === "EAUTH" || (err.responseCode && err.responseCode === 535)) {
        logger.error("SMTP 인증 실패 (재시도 불가):", { error: err.message });
        throw err;
      }
      logger.warn("이메일 발송 시도 " + (attempt + 1) + "/" + (MAX_RETRIES + 1) + " 실패:", {
        error: err.message,
        to: mailOptions.to,
      });
      if (attempt < MAX_RETRIES) {
        var delay = getBackoffDelay(attempt);
        await new Promise(function (resolve) {
          setTimeout(resolve, delay);
        });
      }
    }
  }

  logger.error("이메일 발송 최종 실패:", {
    error: lastError.message,
    to: mailOptions.to,
    attempts: MAX_RETRIES + 1,
  });
  throw lastError;
}

module.exports = { sendEmail };
