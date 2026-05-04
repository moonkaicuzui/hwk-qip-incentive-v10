#!/usr/bin/env node
/**
 * AQL Allowance 신규 기능 안내 이메일 발송 (3개 언어 첨부)
 *
 * 수신: huynhnhurgqa04@hsvina.com (Nguyen Thi Huynh Nhu)
 * CC:   ksmoon@hsvina.com
 * 첨부: ko / en / vi 3개 HTML 안내문
 */

const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) {}

const SMTP_USER = process.env.SMTP_USER || 'ksmoon@hsvina.com';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
if (!SMTP_PASSWORD) {
  console.error('ERROR: SMTP_PASSWORD missing. Check scripts/.env');
  process.exit(1);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs', 'aql_allowance');

const ATTACHMENTS = [
  { filename: 'AQL_Allowance_Guide_KO.html', path: path.join(DOCS_DIR, 'AQL_Allowance_Guide_KO.html') },
  { filename: 'AQL_Allowance_Guide_EN.html', path: path.join(DOCS_DIR, 'AQL_Allowance_Guide_EN.html') },
  { filename: 'AQL_Allowance_Guide_VI.html', path: path.join(DOCS_DIR, 'AQL_Allowance_Guide_VI.html') },
];

for (const a of ATTACHMENTS) {
  if (!fs.existsSync(a.path)) {
    console.error('Attachment not found: ' + a.path);
    process.exit(1);
  }
}

const TO = process.env.TO_EMAIL || 'huynhnhurgqa04@hsvina.com';
const CC = process.env.CC_EMAIL || 'ksmoon@hsvina.com';
const SUBJECT = '[QIP Incentive] AQL Allowance 신규 기능 안내 + 부서장 면담 요청 / Action Required';

const HTML_BODY = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>AQL Allowance Announcement</title></head>
<body style="font-family: -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', sans-serif; max-width: 760px; margin: 30px auto; color: #1f2937; line-height: 1.65; padding: 0 24px;">

<div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #fff; padding: 24px 28px; border-radius: 8px 8px 0 0;">
  <h1 style="margin: 0; font-size: 1.5rem;">HWK QIP Incentive — AQL Allowance 시스템 안내</h1>
  <p style="margin: 8px 0 0; opacity: 0.9; font-size: 0.95rem;">PO 기반 예외 승인 모듈이 신규 추가되었습니다</p>
</div>

<div style="background: #f8fafc; padding: 24px 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">

<p>Nguyen Thi Huynh Nhu님, 안녕하세요.</p>
<p>HWK QIP Incentive Dashboard V10에 <strong>AQL Reject PO Allowance</strong> 기능이 신규 배포되어 안내드립니다. 자세한 내용은 첨부된 한국어 / English / Tiếng Việt 안내문을 참조해 주세요.</p>

<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">

<h3 style="color: #1e40af; margin-top: 0;">📌 핵심 요약 / Key Points</h3>
<ul>
  <li><strong>AQL Allowance 탭</strong>이 관리자 페이지에 신규 추가됨 (기존 Allowance는 "출결 Allowance"로 명칭 변경)</li>
  <li>관리자가 AQL Reject된 PO 번호(복수)와 사유·액션플랜을 입력하면, 시스템이 영향받는 모든 직원의 C5~C8 조건을 자동 면제 처리하여 인센티브를 재계산합니다</li>
  <li>매시간 파이프라인 실행 후에도 자동 재적용되어 데이터 덮어쓰기 방지됨</li>
  <li>대시보드 직원 모달에 파란색 "AQL Allowance" 뱃지 + 액션플랜 진행 상황이 자동 표시됨</li>
</ul>

<h3 style="color: #c0392b;">🤝 협조 요청 사항 / Action Required</h3>

<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 6px; margin: 14px 0;">
<p style="margin: 0 0 8px;"><strong>부서장(팀장)과 면담을 진행하여 아래 정책을 확정해 주시기 바랍니다:</strong></p>
<ol style="margin: 8px 0 0;">
  <li>AQL Reject PO에 대한 <strong>Allowance 승인 권한자 명단</strong></li>
  <li>등록 시 <strong>필수 첨부 자료 종류</strong> (예: root cause 분석 보고서)</li>
  <li><strong>액션플랜 마감일 표준</strong> (예: 등록일로부터 30일 이내)</li>
  <li>면제 사유로 인정 가능한 <strong>외부 요인 카테고리</strong> 명문화</li>
  <li>월별 Allowance 등록 통계의 <strong>QOS 보고 주기</strong></li>
</ol>
</div>

<p>면담이 완료된 후 <strong>면담 결과를 가지고 KS Moon(<a href="mailto:ksmoon@hsvina.com">ksmoon@hsvina.com</a>)에게 미팅 콜</strong>을 요청해 주세요. 정책 확정 후 시스템에 반영하겠습니다.</p>

<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">

<h3 style="color: #1e40af;">📎 첨부 파일 / Attachments</h3>
<ul>
  <li><strong>AQL_Allowance_Guide_KO.html</strong> — 한국어 상세 안내</li>
  <li><strong>AQL_Allowance_Guide_EN.html</strong> — English Detailed Guide</li>
  <li><strong>AQL_Allowance_Guide_VI.html</strong> — Hướng dẫn chi tiết Tiếng Việt</li>
</ul>
<p style="font-size: 0.9em; color: #6b7280;">각 첨부 파일을 더블클릭하여 브라우저에서 열어보실 수 있습니다.</p>

<h3 style="color: #1e40af;">🔗 빠른 접속 / Quick Access</h3>
<p>관리자 페이지: <a href="https://moonkaicuzui.github.io/hwk-qip-incentive-v10/">https://moonkaicuzui.github.io/hwk-qip-incentive-v10/</a> → 로그인 → Admin Panel → "AQL Allowance" 탭</p>

<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">

<p style="font-size: 0.85em; color: #6b7280;">
시스템 관련 문의: KS Moon &lt;ksmoon@hsvina.com&gt;<br>
HWK QIP Incentive Dashboard V10 · AQL Allowance Module v1.0 · 2026-05-04
</p>

</div>
</body>
</html>`;

function createTransporter(port, secure) {
  return nodemailer.createTransport({
    host: 'mail.hsvina.com',
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    authMethod: 'LOGIN',
    tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

async function sendWithFallback(opts) {
  try {
    const t = createTransporter(465, true);
    return await t.sendMail(opts);
  } catch (e1) {
    console.warn('[Email] Port 465 failed: ' + e1.message + ' — trying 587');
    const t = createTransporter(587, false);
    return await t.sendMail(opts);
  }
}

(async () => {
  const mailOptions = {
    from: '"QIP Incentive System" <' + SMTP_USER + '>',
    to: TO,
    cc: CC,
    subject: SUBJECT,
    html: HTML_BODY,
    attachments: ATTACHMENTS,
  };

  console.log('[Email] Sending AQL Allowance announcement...');
  console.log('  From: ' + SMTP_USER);
  console.log('  To:   ' + TO);
  console.log('  CC:   ' + CC);
  console.log('  Subj: ' + SUBJECT);
  console.log('  Attachments: ' + ATTACHMENTS.map(a => a.filename).join(', '));

  try {
    const result = await sendWithFallback(mailOptions);
    console.log('[Email] ✅ Sent successfully. Message ID: ' + result.messageId);
    process.exit(0);
  } catch (err) {
    console.error('[Email] ❌ Failed: ' + err.message);
    process.exit(1);
  }
})();
