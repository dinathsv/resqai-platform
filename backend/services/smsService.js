/**
 * ResQAI — SMSlenz Gateway Service (Node.js).
 * Handles phone normalization, single SMS dispatch, bulk SMS dispatch,
 * and account status checks for the Node.js backend.
 */

const SMSLENZ_USER_ID = process.env.SMSLENZ_USER_ID || '2462';
const SMSLENZ_API_KEY = process.env.SMSLENZ_API_KEY || '3ef7d7d9-1ae3-4615-b43c-b795f67375e7';
const SMSLENZ_SENDER_ID = process.env.SMSLENZ_SENDER_ID || 'SMSlenzDEMO';
const SMSLENZ_BASE_URL = (process.env.SMSLENZ_BASE_URL || 'https://smslenz.lk/api').replace(/\/+$/, '');

/**
 * Normalizes a phone number to international E.164 format (+947XXXXXXXX)
 * required by SMSlenz.
 * @param {string} phone
 * @returns {string|null}
 */
function normalizePhoneNumber(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[\s\-\(\)\.]/g, '').trim();
  if (!cleaned) return null;

  if (cleaned.startsWith('+')) {
    const num = cleaned.slice(1);
    if (num.startsWith('94') && num.length === 11 && num[2] === '7') {
      return `+${num}`;
    }
    if (num.length >= 10 && num.length <= 15 && /^\d+$/.test(num)) {
      return `+${num}`;
    }
    return `+${num}`;
  }

  // 0771234567 -> +94771234567
  if (cleaned.startsWith('0') && cleaned.length === 10 && /^\d+$/.test(cleaned)) {
    return `+94${cleaned.slice(1)}`;
  }

  // 94771234567 -> +94771234567
  if (cleaned.startsWith('94') && cleaned.length === 11 && /^\d+$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // 771234567 -> +94771234567
  if (cleaned.startsWith('7') && cleaned.length === 9 && /^\d+$/.test(cleaned)) {
    return `+94${cleaned}`;
  }

  if (/^\d+$/.test(cleaned) && cleaned.length >= 9 && cleaned.length <= 15) {
    if (cleaned.length === 9) return `+94${cleaned}`;
    return `+${cleaned}`;
  }

  return null;
}

/**
 * Check if SMSlenz gateway is configured.
 * @returns {boolean}
 */
function isConfigured() {
  return Boolean(
    SMSLENZ_USER_ID &&
    SMSLENZ_API_KEY &&
    SMSLENZ_SENDER_ID &&
    SMSLENZ_USER_ID.trim() &&
    SMSLENZ_API_KEY.trim() &&
    SMSLENZ_SENDER_ID.trim()
  );
}

/**
 * Sends a single SMS via SMSlenz POST /api/send-sms.
 * @param {string} contact
 * @param {string} message
 * @returns {Promise<{success: boolean, message: string, data?: any, error?: string}>}
 */
async function sendSMS(contact, message) {
  if (!isConfigured()) {
    console.warn('[SMSlenz] Gateway not configured, skipping sendSMS');
    return { success: false, error: 'SMSlenz not configured', message: 'Gateway not configured' };
  }

  const normalized = normalizePhoneNumber(contact);
  if (!normalized) {
    console.warn(`[SMSlenz] Invalid phone number format: ${contact}`);
    return { success: false, error: 'Invalid phone number', message: 'Invalid phone number' };
  }

  const url = `${SMSLENZ_BASE_URL}/send-sms`;
  const payload = {
    user_id: SMSLENZ_USER_ID,
    api_key: SMSLENZ_API_KEY,
    sender_id: SMSLENZ_SENDER_ID,
    contact: normalized,
    message: String(message).slice(0, 1500),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success === true) {
      console.log(`[SMSlenz] SMS delivered to ${normalized}`);
      return { success: true, message: data.message || 'SMS sent successfully', data: data.data };
    } else {
      const err = data.message || `HTTP ${res.status}`;
      console.error(`[SMSlenz] Delivery failed to ${normalized}: ${err}`);
      return { success: false, error: err, message: err, data: data.data };
    }
  } catch (err) {
    console.error(`[SMSlenz] Error sending SMS to ${normalized}:`, err.message);
    return { success: false, error: err.message, message: 'Network or internal error' };
  }
}

/**
 * Sends bulk SMS via SMSlenz POST /api/send-bulk-sms.
 * @param {string[]} contacts
 * @param {string} message
 * @returns {Promise<{success: boolean, delivered_count: number, message: string, data?: any, error?: string}>}
 */
async function sendBulkSMS(contacts, message) {
  if (!isConfigured()) {
    console.warn('[SMSlenz] Gateway not configured, skipping sendBulkSMS');
    return { success: false, delivered_count: 0, error: 'SMSlenz not configured', message: 'Gateway not configured' };
  }

  const validContacts = [];
  for (const c of contacts) {
    const norm = normalizePhoneNumber(c);
    if (norm && !validContacts.includes(norm)) {
      validContacts.push(norm);
    }
  }

  if (validContacts.length === 0) {
    return { success: false, delivered_count: 0, error: 'No valid phone numbers', message: 'No valid phone numbers' };
  }

  const url = `${SMSLENZ_BASE_URL}/send-bulk-sms`;
  const payload = {
    user_id: SMSLENZ_USER_ID,
    api_key: SMSLENZ_API_KEY,
    sender_id: SMSLENZ_SENDER_ID,
    contacts: validContacts,
    message: String(message).slice(0, 1500),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success === true) {
      const count = data.data?.no_of_recipients ?? validContacts.length;
      console.log(`[SMSlenz] Bulk SMS delivered to ${count} recipients`);
      return { success: true, delivered_count: count, message: data.message || 'Bulk SMS sent', data: data.data };
    } else {
      const err = data.message || `HTTP ${res.status}`;
      console.error(`[SMSlenz] Bulk SMS delivery failed: ${err}`);
      return { success: false, delivered_count: 0, error: err, message: err, data: data.data };
    }
  } catch (err) {
    console.error('[SMSlenz] Error sending bulk SMS:', err.message);
    return { success: false, delivered_count: 0, error: err.message, message: 'Network or internal error' };
  }
}

/**
 * Checks SMSlenz account status and balance.
 * @returns {Promise<any>}
 */
async function getAccountStatus() {
  const url = `${SMSLENZ_BASE_URL}/account-status`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: SMSLENZ_USER_ID, api_key: SMSLENZ_API_KEY }),
    });
    return await res.json();
  } catch (err) {
    console.error('[SMSlenz] Error getting account status:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  normalizePhoneNumber,
  isConfigured,
  sendSMS,
  sendBulkSMS,
  getAccountStatus,
};
