// src/transporter.ts
import nodemailer from "nodemailer";
var DEFAULTS = {
  host: "mail.hsvina.com",
  port: 465,
  authMethod: "LOGIN",
  tls: { rejectUnauthorized: false, minVersion: "TLSv1.2" },
  timeouts: { connection: 1e4, greeting: 1e4, socket: 3e4 }
};
function buildTransportConfig(port, secure, auth, smtp = {}) {
  const tls = {
    rejectUnauthorized: smtp.tls?.rejectUnauthorized ?? DEFAULTS.tls.rejectUnauthorized,
    minVersion: smtp.tls?.minVersion ?? DEFAULTS.tls.minVersion
  };
  if (smtp.tls?.maxVersion) tls.maxVersion = smtp.tls.maxVersion;
  const cfg = {
    host: smtp.host ?? DEFAULTS.host,
    port,
    secure,
    auth: { user: auth.user, pass: auth.pass },
    authMethod: smtp.authMethod ?? DEFAULTS.authMethod,
    tls,
    connectionTimeout: smtp.timeouts?.connection ?? DEFAULTS.timeouts.connection,
    greetingTimeout: smtp.timeouts?.greeting ?? DEFAULTS.timeouts.greeting,
    socketTimeout: smtp.timeouts?.socket ?? DEFAULTS.timeouts.socket
  };
  if (smtp.pool) cfg.pool = true;
  return cfg;
}
var defaultFactory = (port, secure, auth, smtp) => nodemailer.createTransport(buildTransportConfig(port, secure, auth, smtp));
var cache = /* @__PURE__ */ new Map();
function cacheKey(port, auth, smtp) {
  return `${smtp.host ?? DEFAULTS.host}:${port}:${auth.user}`;
}
function getTransporter(port, secure, auth, smtp = {}, nowMs = Date.now(), factory = defaultFactory) {
  const ttl = smtp.cacheTtlMs ?? 6e4;
  const key = cacheKey(port, auth, smtp);
  const hit = cache.get(key);
  if (hit && nowMs - hit.createdAt < ttl) return hit.transporter;
  const transporter = factory(port, secure, auth, smtp);
  cache.set(key, { transporter, createdAt: nowMs });
  return transporter;
}
function clearTransporterCache() {
  cache.clear();
}

// src/sendEmail.ts
var asList = (v) => {
  if (!v) return "";
  return (Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean).join(", ");
};
function stripHtml(html) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+\n/g, "\n").trim();
}
function buildFrom(message, opts) {
  const name = message.from?.name ?? opts.fromPolicy?.displayName;
  const address = message.from?.address ?? opts.fromPolicy?.address ?? opts.auth.user;
  const from = name ? `"${name}" <${address}>` : address;
  let sender = message.sender;
  if (!sender && opts.fromPolicy?.senderEnvelope) {
    sender = opts.fromPolicy.senderEnvelope === "authUser" ? opts.auth.user : opts.fromPolicy.senderEnvelope;
  }
  return { from, sender };
}
function normalizeMessage(message, opts) {
  const { from, sender } = buildFrom(message, opts);
  const norm = {
    from,
    to: asList(message.to),
    subject: message.subject,
    html: message.html
  };
  if (sender) norm.sender = sender;
  if (message.replyTo) norm.replyTo = message.replyTo;
  const cc = asList(message.cc);
  if (cc) norm.cc = cc;
  const bcc = asList(message.bcc);
  if (bcc) norm.bcc = bcc;
  if (message.text) norm.text = message.text;
  else if (opts.autoText) norm.text = stripHtml(message.html);
  if (message.attachments?.length) norm.attachments = message.attachments;
  return norm;
}
var breakers = /* @__PURE__ */ new Map();
var CB_THRESHOLD = 5;
var CB_COOLDOWN_MS = 10 * 6e4;
function isAuthError(err) {
  const e = err;
  return e?.code === "EAUTH" || e?.responseCode === 535 || /invalid login|authentication failed/i.test(e?.message ?? "");
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function _resetBreakers() {
  breakers.clear();
}
async function sendEmail(message, opts) {
  let norm = normalizeMessage(message, opts);
  if (opts.beforeSend) {
    const hooked = opts.beforeSend(norm);
    if (!hooked) {
      const r = { ok: false, skipped: true, skipReason: "beforeSend returned null" };
      await opts.track?.({ ok: false, to: norm.to, subject: norm.subject, skipped: true });
      return r;
    }
    norm = hooked;
  }
  if (!norm.to) {
    const r = { ok: false, skipped: true, skipReason: "no recipients" };
    await opts.track?.({ ok: false, to: "", subject: norm.subject, skipped: true });
    return r;
  }
  if (opts.dryRun) {
    return { ok: true, mailOptions: norm };
  }
  const cbKey = opts.circuitBreakerKey;
  if (cbKey) {
    const b = breakers.get(cbKey);
    if (b && Date.now() < b.openUntil) {
      const r = { ok: false, skipped: true, skipReason: `circuit breaker OPEN (${cbKey})` };
      await opts.track?.({ ok: false, to: norm.to, subject: norm.subject, error: "circuit_open" });
      return r;
    }
  }
  const auth = opts.auth;
  const smtp = opts.smtp ?? {};
  const primaryPort = smtp.port ?? 465;
  const ports = smtp.fallbackPort ? [primaryPort, smtp.fallbackPort] : [primaryPort];
  const retry = opts.retry ?? {};
  const maxRetries = retry.maxRetries ?? 0;
  const baseDelay = retry.baseDelayMs ?? 1e3;
  const skipAuth = retry.skipAuthErrors ?? true;
  const mailOptions = { ...norm };
  let lastErr;
  for (const port of ports) {
    const secure = smtp.secure ?? port === 465;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const transporter = getTransporter(port, secure, auth, smtp, Date.now(), opts._transportFactory);
        const info = await transporter.sendMail(mailOptions);
        if (cbKey) breakers.delete(cbKey);
        const r = { ok: true, messageId: info.messageId, response: info.response, portUsed: port };
        await opts.track?.({ ok: true, to: norm.to, subject: norm.subject, messageId: info.messageId });
        return r;
      } catch (err) {
        lastErr = err;
        if (skipAuth && isAuthError(err)) break;
        if (attempt < maxRetries) await sleep(baseDelay * 2 ** attempt);
      }
    }
    if (skipAuth && isAuthError(lastErr)) break;
  }
  if (cbKey) {
    const b = breakers.get(cbKey) ?? { failCount: 0, openUntil: 0 };
    b.failCount += 1;
    if (b.failCount >= CB_THRESHOLD) {
      b.openUntil = Date.now() + CB_COOLDOWN_MS;
      b.failCount = 0;
    }
    breakers.set(cbKey, b);
  }
  const errMsg = lastErr?.message ?? String(lastErr);
  await opts.track?.({ ok: false, to: norm.to, subject: norm.subject, error: errMsg });
  return { ok: false, error: errMsg };
}

// src/adapters.ts
var FALLBACK_587 = { fallbackPort: 587 };
async function qosSendEmail(config, auth, opts) {
  const message = {
    to: config.to,
    cc: config.cc,
    bcc: config.bcc,
    subject: config.subject,
    html: config.html,
    attachments: config.attachments,
    from: { name: config.fromName ?? "Quality OS \xB7 \uBB38\uACBD\uC11C", address: opts?.fromAddress ?? "ksmoon@hsvina.com" },
    sender: auth.user,
    replyTo: opts?.fromAddress ?? "ksmoon@hsvina.com"
  };
  const r = await sendEmail(message, { auth, smtp: opts?.smtp, track: opts?.track, _transportFactory: opts?._transportFactory });
  return r.ok;
}
async function commonSendEmail(user, pass, options, smtpConfig = FALLBACK_587, extra) {
  const message = {
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
    from: options.fromName ? { name: options.fromName, address: user } : { address: user }
  };
  const r = await sendEmail(message, {
    auth: { user, pass },
    smtp: smtpConfig,
    autoText: extra?.autoText ?? true,
    circuitBreakerKey: extra?.circuitBreakerKey,
    beforeSend: extra?.beforeSend,
    track: extra?.track,
    _transportFactory: extra?._transportFactory
  });
  return r.ok ? { success: true, messageId: r.messageId, response: r.response } : { success: false, reason: r.skipReason ?? r.error };
}
var AQL_SMTP = {
  fallbackPort: 587,
  tls: { rejectUnauthorized: false, minVersion: "TLSv1.2", maxVersion: "TLSv1.2" },
  timeouts: { connection: 15e3, greeting: 3e4, socket: 6e4 }
};
async function aqlSendEmail(smtpPassword, mailOptions, logMeta, track) {
  const r = await sendEmail(
    {
      to: mailOptions.to,
      cc: mailOptions.cc,
      bcc: mailOptions.bcc,
      subject: mailOptions.subject,
      html: mailOptions.html,
      text: mailOptions.text,
      attachments: mailOptions.attachments,
      from: { address: "ksmoon@hsvina.com" }
    },
    {
      auth: { user: "ksmoon@hsvina.com", pass: smtpPassword },
      smtp: AQL_SMTP,
      track: track ? (rec) => track({ ...rec, logMeta }) : void 0
    }
  );
  return r.ok ? { success: true, messageId: r.messageId } : { success: false, reason: r.error };
}
async function qtrainSendEmail(options, user, pass) {
  const fromDisplay = options.fromDisplay ?? process.env.QTRAIN_FROM_DISPLAY ?? "Q-TRAIN System [auto]";
  const fromAddress = options.fromAddress ?? process.env.QTRAIN_FROM_ADDRESS ?? user;
  const r = await sendEmail(
    {
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
      from: { name: fromDisplay, address: fromAddress },
      sender: user
    },
    { auth: { user, pass } }
  );
  return r.ok ? { success: true, messageId: r.messageId } : { success: false, error: r.error };
}
async function loadplanSendEmail(transport, msg) {
  const r = await sendEmail(
    {
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      attachments: msg.attachments,
      from: msg.from ? { address: msg.from } : void 0
    },
    {
      auth: { user: "", pass: "" },
      // transport 주입형 — auth 미사용
      retry: { maxRetries: 1, baseDelayMs: 0 },
      _transportFactory: () => transport
    }
  );
  return r.ok ? { success: true, messageId: r.messageId } : { success: false };
}

// src/spokes/osc.ts
var OSC_DEFAULT_BLOCKED_EMAILS = ["qip@hwk.com", "quality@hwk.com", "hsrg_korean@hsvina.com"];
var OSC_DEFAULT_AUTO_CC = "ksmoon@hsvina.com";
function oscStripHtml(html) {
  return html.replace(/<style[^>]*>.*?<\/style>/gs, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
async function oscSendEmail(smtpUser, smtpPassword, options, _smtpConfig = {}, policy = {}) {
  const blocked = (policy.blockedEmails ?? OSC_DEFAULT_BLOCKED_EMAILS).map((e) => e.toLowerCase());
  const autoCc = policy.autoCc ?? OSC_DEFAULT_AUTO_CC;
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const validRecipients = recipients.filter((email) => !blocked.includes(email?.toLowerCase()));
  if (validRecipients.length === 0) {
    return { success: false, reason: "all_recipients_blocked" };
  }
  const existingCc = options.cc ? Array.isArray(options.cc) ? options.cc : [options.cc] : [];
  const toLower = validRecipients.map((e) => e?.toLowerCase());
  const ccLower = existingCc.map((e) => e?.toLowerCase());
  const ccList = [...existingCc];
  if (autoCc && !toLower.includes(autoCc.toLowerCase()) && !ccLower.includes(autoCc.toLowerCase())) {
    ccList.push(autoCc);
  }
  const text = options.text || oscStripHtml(options.html);
  const r = await sendEmail(
    {
      from: { name: "OSC Inspection System", address: smtpUser },
      to: validRecipients,
      cc: ccList.length > 0 ? ccList : void 0,
      subject: options.subject,
      html: options.html,
      text,
      attachments: options.attachments && options.attachments.length > 0 ? options.attachments : void 0
    },
    {
      auth: { user: smtpUser, pass: smtpPassword },
      smtp: { fallbackPort: 587 },
      circuitBreakerKey: policy.circuitBreakerKey ?? "osc",
      dryRun: policy.dryRun,
      track: policy.track,
      _transportFactory: policy._transportFactory
    }
  );
  if (policy.dryRun) return { success: true, mailOptions: r.mailOptions };
  return r.ok ? { success: true, messageId: r.messageId, response: r.response } : { success: false, reason: r.skipReason ?? r.error };
}

// src/spokes/aql.ts
var AQL_SMTP2 = {
  fallbackPort: 587,
  tls: { rejectUnauthorized: false, minVersion: "TLSv1.2", maxVersion: "TLSv1.2" },
  timeouts: { connection: 15e3, greeting: 3e4, socket: 6e4 }
};
var AQL_SMTP_USER = "ksmoon@hsvina.com";
async function aqlSendViaShared(smtpPassword, mailOptions, logMeta = null, opts = {}) {
  const auth = { user: AQL_SMTP_USER, pass: smtpPassword };
  const to = mailOptions.to;
  const recipients = Array.isArray(to) ? to : String(to ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  let lastErr;
  for (const port of [465, 587]) {
    try {
      const transporter = getTransporter(port, port === 465, auth, AQL_SMTP2, Date.now(), opts._transportFactory);
      const result = await transporter.sendMail(mailOptions);
      if (logMeta && opts.logFn) {
        await opts.logFn({ ...logMeta, recipients, subject: mailOptions.subject || "", status: "success", messageId: result.messageId });
      }
      return result;
    } catch (err) {
      lastErr = err;
      if (port === 587) {
        if (logMeta && opts.logFn) {
          await opts.logFn({ ...logMeta, recipients, subject: mailOptions.subject || "", status: "failed", error: err.message });
        }
        throw err;
      }
    }
  }
  throw lastErr;
}

// src/spokes/remaining.ts
var BASE_TLS = { rejectUnauthorized: false, minVersion: "TLSv1.2" };
var stripTags = (html) => html.replace(/<[^>]*>/g, "");
var sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
var isAuthErr = (e) => e?.code === "EAUTH" || e?.responseCode === 535 || /invalid login|authentication failed|535/i.test(e?.message ?? "");
var _breakers = /* @__PURE__ */ new Map();
async function rawSend(auth, mailOptions, p) {
  const cbKey = p.circuitBreakerKey;
  if (cbKey) {
    const b = _breakers.get(cbKey);
    if (b && Date.now() < b.openUntil) throw new Error("SMTP circuit breaker open. Too many consecutive failures.");
  }
  const ports = p.fallback587 ? [465, 587] : [465];
  const retryMax = p.retryMax ?? 0;
  let lastErr;
  for (const port of ports) {
    for (let attempt = 0; attempt <= retryMax; attempt++) {
      try {
        const t = getTransporter(port, port === 465, auth, p.smtp, Date.now(), p._transportFactory);
        const info = await t.sendMail(mailOptions);
        if (cbKey) _breakers.delete(cbKey);
        return info;
      } catch (err) {
        lastErr = err;
        if (p.skipAuth && isAuthErr(err)) throw err;
        if (attempt < retryMax) await sleep2(2 ** attempt * 1e3);
      }
    }
  }
  if (cbKey) {
    const b = _breakers.get(cbKey) ?? { fail: 0, openUntil: 0 };
    b.fail += 1;
    if (b.fail >= 5) {
      b.openUntil = Date.now() + 10 * 6e4;
      b.fail = 0;
    }
    _breakers.set(cbKey, b);
  }
  throw lastErr;
}
function _resetSpokeBreakers() {
  _breakers.clear();
}
var BGRADE_SMTP = { tls: BASE_TLS, timeouts: { connection: 1e4, greeting: 1e4, socket: 3e4 } };
async function bgradeSendEmail(smtpUser, smtpPassword, options, smtpConfig = {}, opts = {}) {
  const { to, cc, subject, html, text, attachments } = options;
  const mailOptions = {
    from: '"HWK B-Grade System" <ksmoon@hsvina.com>',
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    html,
    text: text || (html ? stripTags(html) : "")
  };
  if (cc) mailOptions.cc = Array.isArray(cc) ? cc.join(", ") : cc;
  if (attachments && attachments.length > 0) mailOptions.attachments = attachments;
  try {
    const info = await rawSend(
      { user: smtpUser, pass: smtpPassword },
      mailOptions,
      { smtp: { ...BGRADE_SMTP, ...smtpConfig }, fallback587: true, circuitBreakerKey: opts.circuitBreakerKey ?? "bgrade", _transportFactory: opts._transportFactory }
    );
    return { success: true, messageId: info.messageId, response: info.response };
  } catch (err) {
    throw new Error(`Email send failed: ${err.message}`);
  }
}
var HR_SMTP = { pool: true, tls: BASE_TLS, timeouts: { connection: 1e4, greeting: 1e4, socket: 3e4 } };
async function hrSendEmail(smtpUser, smtpPassword, options, opts = {}) {
  const joinAddrs = (v) => Array.isArray(v) ? v.filter(Boolean).join(", ") : v;
  const mailOptions = {
    from: smtpUser,
    to: joinAddrs(options.to),
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, "")
  };
  if (options.cc && (Array.isArray(options.cc) ? options.cc.length : options.cc)) mailOptions.cc = joinAddrs(options.cc);
  if (options.bcc && (Array.isArray(options.bcc) ? options.bcc.length : options.bcc)) mailOptions.bcc = joinAddrs(options.bcc);
  if (options.replyTo) mailOptions.replyTo = options.replyTo;
  if (Array.isArray(options.attachments) && options.attachments.length > 0) mailOptions.attachments = options.attachments;
  const info = await rawSend(
    { user: smtpUser, pass: smtpPassword },
    mailOptions,
    { smtp: HR_SMTP, retryMax: 2, skipAuth: true, _transportFactory: opts._transportFactory }
  );
  return { messageId: info.messageId };
}
var INCENTIVE_SMTP = { pool: true, tls: BASE_TLS, timeouts: { connection: 1e4, greeting: 1e4, socket: 3e4 } };
async function incentiveSendEmail(smtpUser, smtpPassword, options, opts = {}) {
  const mailOptions = {
    from: smtpUser,
    to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, "")
  };
  if (options.attachments) mailOptions.attachments = options.attachments;
  const info = await rawSend(
    { user: smtpUser, pass: smtpPassword },
    mailOptions,
    { smtp: INCENTIVE_SMTP, retryMax: 2, skipAuth: true, _transportFactory: opts._transportFactory }
  );
  return { messageId: info.messageId };
}
var CHARCOAL_SMTP = { tls: BASE_TLS, timeouts: { connection: 1e4, greeting: 1e4, socket: 15e3 } };
async function charcoalSendEmail(smtpUser, smtpPassword, options, smtpConfig = {}, opts = {}) {
  const mailOptions = {
    from: `"Charcoal Box Monitor" <${smtpUser}>`,
    to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || oscStripHtml(options.html)
  };
  if (options.attachments && options.attachments.length > 0) {
    mailOptions.attachments = options.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType || "application/octet-stream"
    }));
  }
  try {
    const info = await rawSend(
      { user: smtpUser, pass: smtpPassword },
      mailOptions,
      { smtp: { ...CHARCOAL_SMTP, ...smtpConfig }, fallback587: true, _transportFactory: opts._transportFactory }
    );
    return { success: true, messageId: info.messageId, response: info.response };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
var LOADPLAN_SMTP = { tls: BASE_TLS };
async function loadplanSend(smtpUser, smtpPassword, msg, opts = {}) {
  const mailOptions = {
    from: `"Rachgia Dashboard" <${smtpUser}>`,
    to: msg.to,
    // 호출부가 join (caller-side)
    subject: msg.subject,
    html: msg.html
  };
  if (msg.cc) mailOptions.cc = msg.cc;
  if (Array.isArray(msg.attachments) && msg.attachments.length) mailOptions.attachments = msg.attachments;
  const auth = { user: smtpUser, pass: smtpPassword };
  try {
    const info = await rawSend(auth, mailOptions, { smtp: LOADPLAN_SMTP, _transportFactory: opts._transportFactory });
    return { success: true, messageId: info.messageId };
  } catch {
    const info = await rawSend(auth, mailOptions, { smtp: LOADPLAN_SMTP, _transportFactory: opts._transportFactory });
    return { success: true, messageId: info.messageId, retried: true };
  }
}
var QTRAIN_SMTP = { tls: BASE_TLS };
async function qtrainSend(options, smtpUser, smtpPassword, opts = {}) {
  const recipients = Array.isArray(options.to) ? options.to.join(", ") : options.to;
  const fromDisplay = opts.fromDisplay ?? process.env.QTRAIN_FROM_DISPLAY ?? "Q-TRAIN System [auto]";
  const fromAddress = opts.fromAddress ?? process.env.QTRAIN_FROM_ADDRESS ?? smtpUser;
  const mailOptions = {
    from: `"${fromDisplay}" <${fromAddress}>`,
    sender: smtpUser,
    replyTo: options.replyTo || smtpUser,
    to: recipients,
    subject: options.subject,
    html: options.html
  };
  if (options.text) mailOptions.text = options.text;
  if (options.attachments) mailOptions.attachments = options.attachments;
  if (options.cc) mailOptions.cc = options.cc;
  if (options.bcc) mailOptions.bcc = options.bcc;
  try {
    const info = await rawSend({ user: smtpUser, pass: smtpPassword }, mailOptions, { smtp: QTRAIN_SMTP, _transportFactory: opts._transportFactory });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
export {
  AQL_SMTP2 as AQL_SMTP,
  AQL_SMTP_USER,
  OSC_DEFAULT_AUTO_CC,
  OSC_DEFAULT_BLOCKED_EMAILS,
  _resetBreakers,
  _resetSpokeBreakers,
  aqlSendEmail,
  aqlSendViaShared,
  bgradeSendEmail,
  buildTransportConfig,
  charcoalSendEmail,
  clearTransporterCache,
  commonSendEmail,
  getTransporter,
  hrSendEmail,
  incentiveSendEmail,
  loadplanSend,
  loadplanSendEmail,
  normalizeMessage,
  oscSendEmail,
  oscStripHtml,
  qosSendEmail,
  qtrainSend,
  qtrainSendEmail,
  sendEmail,
  stripHtml
};
