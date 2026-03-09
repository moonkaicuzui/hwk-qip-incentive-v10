#!/usr/bin/env node
/**
 * HWK QIP Incentive V10 - 범용 이메일 발송 스크립트
 * Q-TRAIN 프로젝트와 동일한 SMTP 패턴 (mail.hsvina.com:465)
 *
 * 사용법:
 *   node scripts/sendEmail.js --to "hwk_qa@hsvina.com" --subject "제목" --body "본문"
 *   node scripts/sendEmail.js --to "a@hsvina.com,b@hsvina.com" --subject "제목" --html "<h1>HTML</h1>"
 *   node scripts/sendEmail.js --to "user@hsvina.com" --subject "제목" --html-file "output_files/report.html"
 *
 * 환경변수 (.env):
 *   SMTP_USER=ksmoon@hsvina.com
 *   SMTP_PASSWORD=비밀번호
 */

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// .env 로드
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch {
  // dotenv 없으면 환경변수 직접 사용
}

// ─── SMTP 설정 ───────────────────────────────
const SMTP_USER = process.env.SMTP_USER || 'ksmoon@hsvina.com';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

if (!SMTP_PASSWORD) {
  console.error('ERROR: SMTP_PASSWORD 환경변수가 필요합니다. scripts/.env 파일을 확인하세요.');
  process.exit(1);
}

// ─── 인자 파싱 ───────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    parsed[key] = args[i + 1];
  }
  return parsed;
}

// ─── 트랜스포터 생성 ─────────────────────────
function createTransporter(port = 465, secure = true) {
  return nodemailer.createTransport({
    host: 'mail.hsvina.com',
    port,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
    authMethod: 'LOGIN',
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

// ─── 메일 발송 (465 SSL → 587 STARTTLS 폴백) ───
async function sendEmail(options) {
  const mailOptions = {
    from: `"QIP Incentive System" <${SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
  };

  // HTML 본문 결정: --html-file > --html > --body
  if (options['html-file']) {
    var resolvedPath = path.resolve(options['html-file']);
    var allowedBase = path.resolve(__dirname, '..');
    if (!resolvedPath.startsWith(allowedBase)) {
      throw new Error('html-file path must be within the project directory');
    }
    if (!fs.existsSync(resolvedPath)) {
      throw new Error('html-file not found: ' + resolvedPath);
    }
    mailOptions.html = fs.readFileSync(resolvedPath, 'utf-8');
  } else if (options.html) {
    mailOptions.html = options.html;
  } else {
    mailOptions.text = options.body || options.text || '';
  }

  if (options.cc) mailOptions.cc = options.cc;
  if (options.bcc) mailOptions.bcc = options.bcc;

  // 첨부파일 (--attachment 경로) — 프로젝트 디렉토리 내로 제한
  if (options.attachment) {
    var attachPath = path.resolve(options.attachment);
    var projBase = path.resolve(__dirname, '..');
    if (!attachPath.startsWith(projBase)) {
      throw new Error('attachment path must be within the project directory');
    }
    if (!fs.existsSync(attachPath)) {
      throw new Error('attachment not found: ' + attachPath);
    }
    mailOptions.attachments = [{
      filename: path.basename(attachPath),
      path: attachPath,
    }];
  }

  console.log(`[Email] Sending...`);
  console.log(`  From: ${SMTP_USER}`);
  console.log(`  To:   ${mailOptions.to}`);
  console.log(`  Subj: ${mailOptions.subject}`);

  // 1차: 포트 465 SSL
  try {
    const transporter = createTransporter(465, true);
    const result = await transporter.sendMail(mailOptions);
    console.log(`[Email] Sent successfully (port 465 SSL). Message ID: ${result.messageId}`);
    return result;
  } catch (err1) {
    console.warn(`[Email] Port 465 failed: ${err1.message}`);

    // 2차: 포트 587 STARTTLS
    try {
      const transporter = createTransporter(587, false);
      const result = await transporter.sendMail(mailOptions);
      console.log(`[Email] Sent successfully (port 587 STARTTLS). Message ID: ${result.messageId}`);
      return result;
    } catch (err2) {
      console.error(`[Email] Failed. Port 465: ${err1.message} | Port 587: ${err2.message}`);
      throw new Error('Email delivery failed');
    }
  }
}

// ─── CLI 실행 ─────────────────────────────────
async function main() {
  const args = parseArgs();

  if (!args.to || !args.subject) {
    console.log('Usage: node scripts/sendEmail.js --to "recipient" --subject "subject" --body "body"');
    console.log('Options:');
    console.log('  --html "<h1>HTML body</h1>"     HTML content');
    console.log('  --html-file "path/to/file.html" HTML file path');
    console.log('  --body "plain text"              Plain text body');
    console.log('  --cc "cc@hsvina.com"             CC recipients');
    console.log('  --bcc "bcc@hsvina.com"           BCC recipients');
    console.log('  --attachment "path/to/file"       File attachment');
    process.exit(1);
  }

  try {
    await sendEmail(args);
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

// CLI로 실행될 때만 main 호출, require로 가져올 때는 함수만 export
if (require.main === module) {
  main();
} else {
  module.exports = { sendEmail, createTransporter };
}
