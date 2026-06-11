/**
 * QOS V3 shared-email 벨트(belt) 테스트 — Step 0 스포크 Incentive V10 (hwk-qip-incentive-dashboard)
 * (Q-Train 396be5a / B-Grade require.cache 스텁 패턴 — Incentive CJS functions 에 맞춤. node:test, 추가 의존성 0)
 *
 * 실행: node --test functions/services/sharedEmailBelt.test.js  (repo root 기준)
 *
 * 범위: V10 functions 의 node 발송만 (V11 python 메일은 SMTP 직접 — node 번들 적용 불가, 별도 계통).
 *
 * 보장하는 것:
 *  A. 스위치 OFF (config/v3_pilot.useSharedEmail ≠ true) → 기존 nodemailer 경로 100% 보존
 *     (pooled transport per-call · from=smtpUser · to join · text 자동생성 · 첨부 · MAX_RETRIES=2
 *      백오프 · EAUTH 즉시 throw · {messageId} 반환 · cc/bcc/replyTo 미지원 그대로).
 *  B. 스위치 ON → 벤더 번들(sharedEmailPilot.mjs) incentiveSendEmail 위임 + parity:
 *     transport config 1:1 (pool·authMethod LOGIN·tls·timeouts) · mailOptions 1:1 · EAUTH skip-retry.
 *     ON/OFF 판별 = 번들 60s transporter 캐시 (legacy 는 per-call 생성).
 *  C. 벨트 무결성 — CF 길목은 services/emailService.js 뿐, 우회 0.
 *     (functions/scripts/ 의 nodemailer 직접 사용 2파일은 수동 1회성 스크립트 — index.js 가 require 하지
 *      않아 CF 표면 아님. 스윕에서 scripts/ 제외 근거.)
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_ROOT = path.resolve(__dirname, '..');
const EMAIL_SERVICE = path.join(FUNCTIONS_ROOT, 'services', 'emailService.js');

// ── 스텁 상태 ─────────────────────────────────────────────────────────
let flagData = null;
let flagError = null;
const transports = [];
let sendMailImpl = null;

function makeTransport(config) {
  const t = {
    options: config,
    config,
    sent: [],
    calls: 0,
    async sendMail(mailOptions) {
      t.calls += 1;
      if (sendMailImpl) return sendMailImpl(t, mailOptions);
      t.sent.push(mailOptions);
      return { messageId: `<stub-${transports.indexOf(t)}-${t.calls}>`, response: '250 OK' };
    },
  };
  transports.push(t);
  return t;
}

function stubCjsModule(specifier, exportsObj) {
  const filename = require.resolve(specifier);
  require.cache[filename] = { id: filename, filename, loaded: true, exports: exportsObj };
}

stubCjsModule('nodemailer', { createTransport: (config) => makeTransport(config) });
stubCjsModule('firebase-functions', {
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
});
stubCjsModule('firebase-admin/firestore', {
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => {
          if (flagError) throw flagError;
          return { exists: flagData !== null, data: () => flagData };
        },
      }),
    }),
  }),
});

let userSeq = 0;
function freshService() {
  delete require.cache[require.resolve(EMAIL_SERVICE)];
  const svc = require(EMAIL_SERVICE);
  userSeq += 1;
  return { svc, user: `inc-u${userSeq}@hsvina.com`, pass: `pw${userSeq}` };
}

function reset() {
  flagData = null;
  flagError = null;
  transports.length = 0;
  sendMailImpl = null;
}

const baseOpts = { to: 'recipient@hsvina.com', subject: 'Belt Test', html: '<p>Hello <b>Incentive</b></p>' };

/** 레거시 transport config (emailService.js L54-71 1:1) */
function legacyConfig(user, pass) {
  return {
    host: 'mail.hsvina.com', port: 465, secure: true, pool: true,
    auth: { user, pass }, authMethod: 'LOGIN',
    tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 30000,
  };
}

// =====================================================================
// A. 스위치 OFF — 기존 경로 100% 보존
// =====================================================================

test('OFF: config/v3_pilot 문서 없음(기본값) → 레거시 transport config 1:1 + mailOptions 보존', async () => {
  reset();
  const { svc, user, pass } = freshService();

  const r = await svc.sendEmail(user, pass, baseOpts);

  assert.ok(r.messageId);
  assert.equal(transports.length, 1);
  assert.deepEqual(transports[0].config, legacyConfig(user, pass));
  const mailOpts = transports[0].sent[0];
  assert.equal(mailOpts.from, user, 'from = smtpUser (표시명 없음)');
  assert.equal(mailOpts.to, 'recipient@hsvina.com');
  assert.equal(mailOpts.text, 'Hello Incentive', 'text 자동생성 (tag strip)');
  assert.ok(!('cc' in mailOpts) && !('bcc' in mailOpts), 'Incentive 레거시는 cc/bcc 미지원');
});

test('OFF: useSharedEmail:false / 문자열 "true" → 레거시 (=== true 엄격 비교)', async () => {
  reset();
  flagData = { useSharedEmail: false };
  let f = freshService();
  await f.svc.sendEmail(f.user, f.pass, baseOpts);
  assert.equal(transports.length, 1);

  flagData = { useSharedEmail: 'true' };
  f = freshService();
  await f.svc.sendEmail(f.user, f.pass, baseOpts);
  assert.equal(transports.length, 2, '문자열 true 도 레거시 (per-call 생성)');
});

test('OFF: Firestore 플래그 읽기 오류 → fail-safe 레거시', async () => {
  reset();
  flagError = new Error('firestore down');
  const { svc, user, pass } = freshService();

  const r = await svc.sendEmail(user, pass, baseOpts);

  assert.ok(r.messageId);
  assert.equal(transports.length, 1);
});

test('OFF: per-call transport 생성 — 2회 발송 = createTransport 2회 (레거시 시그니처)', async () => {
  reset();
  const { svc, user, pass } = freshService();

  await svc.sendEmail(user, pass, baseOpts);
  await svc.sendEmail(user, pass, baseOpts);

  assert.equal(transports.length, 2);
});

test('OFF: to 배열 join + 첨부 parity', async () => {
  reset();
  const { svc, user, pass } = freshService();
  const attachments = [{ filename: 'incentive.xlsx', content: Buffer.from('x'), contentType: 'application/vnd.test' }];

  await svc.sendEmail(user, pass, { ...baseOpts, to: ['a@x.com', 'b@x.com'], attachments });

  const mailOpts = transports[0].sent[0];
  assert.equal(mailOpts.to, 'a@x.com, b@x.com');
  assert.deepEqual(mailOpts.attachments, attachments);
});

test('OFF: EAUTH(code) → 재시도 없이 즉시 throw', async () => {
  reset();
  const { svc, user, pass } = freshService();
  sendMailImpl = async () => {
    const err = new Error('Invalid login');
    err.code = 'EAUTH';
    throw err;
  };

  await assert.rejects(() => svc.sendEmail(user, pass, baseOpts), /Invalid login/);
  assert.equal(transports[0].calls, 1);
});

test('OFF: 1차 실패(일시 오류) → 백오프 재시도 성공 {messageId}', async () => {
  reset();
  const { svc, user, pass } = freshService();
  let n = 0;
  sendMailImpl = async (t, mailOptions) => {
    n += 1;
    if (n === 1) throw new Error('smtp hiccup');
    t.sent.push(mailOptions);
    return { messageId: '<retry-ok>' };
  };

  const r = await svc.sendEmail(user, pass, baseOpts);

  assert.deepEqual(r, { messageId: '<retry-ok>' });
  assert.equal(transports[0].calls, 2);
});

// =====================================================================
// B. 스위치 ON — 실번들(incentiveSendEmail) 위임 parity
// =====================================================================

test('ON: 번들 위임 — transport config 1:1 (pool·LOGIN·tls·timeouts) + mailOptions parity + {messageId}', async () => {
  reset();
  flagData = { useSharedEmail: true };
  const { svc, user, pass } = freshService();

  const r = await svc.sendEmail(user, pass, baseOpts);

  assert.ok(r.messageId);
  assert.equal(Object.keys(r).length, 1, '반환 계약 {messageId} 단독');
  assert.equal(transports.length, 1);
  assert.deepEqual(transports[0].config, legacyConfig(user, pass), '번들 config = 레거시 config byte-parity');
  const mailOpts = transports[0].sent[0];
  assert.equal(mailOpts.from, user);
  assert.equal(mailOpts.to, 'recipient@hsvina.com');
  assert.equal(mailOpts.subject, 'Belt Test');
  assert.equal(mailOpts.html, '<p>Hello <b>Incentive</b></p>');
  assert.equal(mailOpts.text, 'Hello Incentive');
});

test('ON: 번들 60s transporter 캐시 — 2회 발송 = createTransport 1회 (위임 판별 표식)', async () => {
  reset();
  flagData = { useSharedEmail: true };
  const { svc, user, pass } = freshService();

  await svc.sendEmail(user, pass, baseOpts);
  await svc.sendEmail(user, pass, baseOpts);

  assert.equal(transports.length, 1, '번들 캐시 재사용 — 레거시(per-call 2회)와 구별');
  assert.equal(transports[0].calls, 2);
});

test('ON: to 배열 join + 첨부 parity', async () => {
  reset();
  flagData = { useSharedEmail: true };
  const { svc, user, pass } = freshService();
  const attachments = [{ filename: 'report.xlsx', content: Buffer.from('x') }];

  await svc.sendEmail(user, pass, { ...baseOpts, to: ['a@x.com', 'b@x.com'], attachments });

  const mailOpts = transports[0].sent[0];
  assert.equal(mailOpts.to, 'a@x.com, b@x.com');
  assert.deepEqual(mailOpts.attachments, attachments);
});

test('ON: EAUTH → 재시도 없이 즉시 throw (skipAuth 계약 보존)', async () => {
  reset();
  flagData = { useSharedEmail: true };
  const { svc, user, pass } = freshService();
  sendMailImpl = async () => {
    const err = new Error('Invalid login');
    err.code = 'EAUTH';
    throw err;
  };

  await assert.rejects(() => svc.sendEmail(user, pass, baseOpts), /Invalid login/);
  assert.equal(transports[0].calls, 1);
});

test('ON: 1차 실패(일시 오류) → 백오프 재시도 성공 {messageId} (재시도 계약 보존)', async () => {
  reset();
  flagData = { useSharedEmail: true };
  const { svc, user, pass } = freshService();
  let n = 0;
  sendMailImpl = async (t, mailOptions) => {
    n += 1;
    if (n === 1) throw new Error('smtp hiccup');
    t.sent.push(mailOptions);
    return { messageId: '<bundle-retry-ok>' };
  };

  const r = await svc.sendEmail(user, pass, baseOpts);

  assert.deepEqual(r, { messageId: '<bundle-retry-ok>' });
});

test('ON: 플래그 60s 캐시 — 2회 발송 시 Firestore 1회만 조회', async () => {
  reset();
  let reads = 0;
  flagData = { useSharedEmail: true };
  const filename = require.resolve('firebase-admin/firestore');
  const orig = require.cache[filename].exports;
  require.cache[filename].exports = {
    getFirestore: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => {
            reads += 1;
            return { exists: true, data: () => flagData };
          },
        }),
      }),
    }),
  };
  try {
    const { svc, user, pass } = freshService();
    await svc.sendEmail(user, pass, baseOpts);
    await svc.sendEmail(user, pass, baseOpts);
    assert.equal(reads, 1);
  } finally {
    require.cache[filename].exports = orig;
  }
});

// =====================================================================
// C. 벨트 무결성 — 우회 발송 0
// =====================================================================

test('무결성: CF 표면 재귀 스윕 — nodemailer 사용은 길목(emailService.js)+번들뿐 (scripts/ 제외)', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (f.name === 'node_modules' || f.name === 'scripts' || f.name.startsWith('.')) continue;
      const full = path.join(dir, f.name);
      if (f.isDirectory()) { walk(full); continue; }
      if (!/\.(js|mjs|cjs)$/.test(f.name) || f.name.endsWith('.test.js')) continue;
      const rel = path.relative(FUNCTIONS_ROOT, full);
      if (rel === path.join('services', 'emailService.js')) continue;
      if (rel === path.join('services', 'sharedEmailPilot.mjs')) continue;
      const src = fs.readFileSync(full, 'utf8');
      if (/require\(['"]nodemailer['"]\)/.test(src) || /from\s+['"]nodemailer['"]/.test(src)) {
        offenders.push(rel);
      }
    }
  };
  walk(FUNCTIONS_ROOT);
  assert.deepEqual(offenders, [], `우회 발송 경로 발견: ${offenders.join(', ')}`);
});

test('무결성: index.js 가 scripts/ 를 require 하지 않음 (수동 스크립트 = CF 표면 밖 근거)', () => {
  const src = fs.readFileSync(path.join(FUNCTIONS_ROOT, 'index.js'), 'utf8');
  assert.ok(!/require\(['"]\.\/scripts\//.test(src), 'scripts/ 는 index.js 미참조 — 1회성 수동 도구');
  assert.ok(!/require\(['"]nodemailer['"]\)/.test(src), 'index.js 직접 발송 없음');
});

test('무결성: 가드 형태 — 엄격비교 + 번들 import + 레거시 발송보다 앞', () => {
  const src = fs.readFileSync(EMAIL_SERVICE, 'utf8');
  assert.match(src, /useSharedEmail === true/);
  assert.match(src, /import\("\.\/sharedEmailPilot\.mjs"\)/);
  assert.match(src, /incentiveSendEmail\(smtpUser, smtpPassword, options\)/);
  assert.ok(src.indexOf('_v3UseSharedEmail()') < src.indexOf('nodemailer.createTransport'), '가드가 transport 생성보다 앞');
});

test('무결성: 벤더 번들 — incentiveSendEmail export + loadplanSend cc 패치 동기 (전 스포크 해시 invariant)', () => {
  const bundle = fs.readFileSync(path.join(FUNCTIONS_ROOT, 'services', 'sharedEmailPilot.mjs'), 'utf8');
  assert.match(bundle, /incentiveSendEmail/);
  assert.match(bundle, /if \(msg\.cc\) mailOptions\.cc = msg\.cc;/, '전 스포크 단일 번들 invariant');
});
