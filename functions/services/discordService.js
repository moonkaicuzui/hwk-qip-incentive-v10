/**
 * Incentive Discord Service
 * Reads webhook URL from Firestore config/discord (pushed by QOS)
 * Sends Discord messages with automatic chunking at 1900 chars
 */
const { getFirestore } = require('firebase-admin/firestore');

let cachedWebhook = null;
let cacheTime = 0;

async function getWebhookUrl() {
  if (cachedWebhook && Date.now() - cacheTime < 300000) return cachedWebhook;
  const doc = await getFirestore().doc('config/discord').get();
  const data = doc.exists ? doc.data() : {};
  cachedWebhook = data.enabled !== false ? (data.webhookUrl || '') : '';
  cacheTime = Date.now();
  return cachedWebhook;
}

async function sendDiscordMessage(content) {
  const url = await getWebhookUrl();
  if (!url) { console.log('[Discord] Webhook not configured, skipping'); return false; }

  const chunks = [];
  let remaining = content;
  while (remaining.length > 0) {
    if (remaining.length <= 1900) { chunks.push(remaining); break; }
    const cut = remaining.lastIndexOf('\n', 1900);
    chunks.push(remaining.substring(0, cut > 0 ? cut : 1900));
    remaining = remaining.substring(cut > 0 ? cut + 1 : 1900);
  }

  for (const chunk of chunks) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chunk }),
      });
      if (!resp.ok) console.error('[Discord] Send failed:', resp.status);
    } catch (err) {
      console.error('[Discord] Error:', err.message);
      return false;
    }
  }
  return true;
}

module.exports = { sendDiscordMessage };
