const crypto = require('node:crypto');
const { db } = require('../config/database');

// 6 hours in milliseconds (6 * 60 * 60 * 1000)
const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = 'dokutra_sid';

/**
 * Parse Cookie header into key-value object
 * @param {string} cookieHeader
 * @returns {Record<string, string>}
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      const val = decodeURIComponent(part.slice(idx + 1).trim());
      cookies[key] = val;
    }
  }
  return cookies;
}

/**
 * Build Set-Cookie header string for 6-hour persistence
 * @param {string} sid
 * @param {number} maxAgeMs
 * @returns {string}
 */
function buildSessionCookie(sid, maxAgeMs = SESSION_DURATION_MS) {
  const maxAgeSeconds = Math.floor(maxAgeMs / 1000);
  const expiresDate = new Date(Date.now() + maxAgeMs).toUTCString();
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}; Expires=${expiresDate}`;
}

/**
 * Build Set-Cookie header string to clear cookie on logout
 * @returns {string}
 */
function buildClearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Create a new 6-hour session in SQLite for the authenticated user
 * @param {number} userId
 * @returns {{ sid: string, expire: number }}
 */
function createSession(userId) {
  // Clean up expired sessions first
  const now = Date.now();
  db.prepare('DELETE FROM sessions WHERE expire <= ?').run(now);

  const sid = crypto.randomBytes(32).toString('hex');
  const expire = now + SESSION_DURATION_MS;
  const sessData = JSON.stringify({ userId, createdAt: now });

  db.prepare(`
    INSERT INTO sessions (sid, user_id, sess, expire)
    VALUES (?, ?, ?, ?)
  `).run(sid, userId, sessData, expire);

  return { sid, expire };
}

/**
 * Retrieve active session and corresponding user + section details
 * Also refreshes the 6-hour rolling expiration window if active
 * @param {string} sid
 * @returns {object | null}
 */
function getActiveSessionUser(sid) {
  if (!sid) return null;

  const now = Date.now();
  const sessionRow = db.prepare(`
    SELECT sid, user_id, sess, expire
    FROM sessions
    WHERE sid = ?
  `).get(sid);

  if (!sessionRow) {
    return null;
  }

  if (sessionRow.expire <= now) {
    db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
    return null;
  }

  // Rolling 6-hour session refresh on active usage
  const newExpire = now + SESSION_DURATION_MS;
  db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?').run(newExpire, sid);

  const user = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.full_name,
      u.section_id,
      u.theme_mode,
      u.last_login,
      s.code AS section_code,
      s.name AS section_name,
      s.short_name AS section_short_name,
      s.description AS section_description
    FROM users u
    JOIN sections s ON u.section_id = s.id
    WHERE u.id = ?
  `).get(sessionRow.user_id);

  if (!user) {
    return null;
  }

  return {
    user,
    sid,
    expire: newExpire
  };
}

/**
 * Destroy session in SQLite
 * @param {string} sid
 */
function destroySession(sid) {
  if (!sid) return;
  db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
}

module.exports = {
  SESSION_DURATION_MS,
  SESSION_COOKIE_NAME,
  parseCookies,
  buildSessionCookie,
  buildClearSessionCookie,
  createSession,
  getActiveSessionUser,
  destroySession
};

