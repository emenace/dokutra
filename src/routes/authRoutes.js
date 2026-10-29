const { db, verifyPassword } = require('../config/database');
const {
  SESSION_COOKIE_NAME,
  parseCookies,
  buildSessionCookie,
  buildClearSessionCookie,
  createSession,
  getActiveSessionUser,
  destroySession
} = require('../middleware/auth');

/**
 * Handle POST /api/auth/login
 */
function handleLogin(req, res, body) {
  const username = (body.username || '').trim().toLowerCase();
  const password = body.password || '';

  if (!username || !password) {
    return res.sendJson(400, {
      success: false,
      message: 'Nama pengguna (username) dan kata sandi wajib diisi.'
    });
  }

  const userRecord = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.password_hash,
      u.full_name,
      u.section_id,
      u.theme_mode,
      s.code AS section_code,
      s.name AS section_name,
      s.short_name AS section_short_name,
      s.description AS section_description
    FROM users u
    JOIN sections s ON u.section_id = s.id
    WHERE LOWER(u.username) = ?
  `).get(username);

  if (!userRecord || !verifyPassword(password, userRecord.password_hash)) {
    return res.sendJson(401, {
      success: false,
      message: 'Nama pengguna atau kata sandi tidak sesuai.'
    });
  }

  // Update last_login timestamp
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userRecord.id);

  // Create 6-hour persistent session in SQLite
  const { sid, expire } = createSession(userRecord.id);
  res.setHeader('Set-Cookie', buildSessionCookie(sid));

  return res.sendJson(200, {
    success: true,
    message: 'Berhasil masuk ke sistem DOKUTRA.',
    sessionExpiresAt: expire,
    user: {
      id: userRecord.id,
      username: userRecord.username,
      full_name: userRecord.full_name,
      section_id: userRecord.section_id,
      section_code: userRecord.section_code,
      section_name: userRecord.section_name,
      section_short_name: userRecord.section_short_name,
      section_description: userRecord.section_description,
      theme_mode: userRecord.theme_mode
    }
  });
}

/**
 * Handle POST /api/auth/logout
 */
function handleLogout(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[SESSION_COOKIE_NAME];
  if (sid) {
    destroySession(sid);
  }
  res.setHeader('Set-Cookie', buildClearSessionCookie());
  return res.sendJson(200, {
    success: true,
    message: 'Anda telah keluar dari sesi.'
  });
}

/**
 * Handle GET /api/auth/me
 */
function handleGetMe(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[SESSION_COOKIE_NAME];
  const sessionData = getActiveSessionUser(sid);

  if (!sessionData) {
    return res.sendJson(401, {
      success: false,
      authenticated: false,
      message: 'Sesi tidak ditemukan atau telah berakhir (6 jam).'
    });
  }

  // Refresh cookie expiration header so browser keeps it for another 6 hours
  res.setHeader('Set-Cookie', buildSessionCookie(sessionData.sid));

  return res.sendJson(200, {
    success: true,
    authenticated: true,
    sessionExpiresAt: sessionData.expire,
    user: sessionData.user
  });
}

/**
 * Handle PUT /api/auth/theme
 */
function handleUpdateTheme(req, res, body) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[SESSION_COOKIE_NAME];
  const sessionData = getActiveSessionUser(sid);

  if (!sessionData) {
    return res.sendJson(401, {
      success: false,
      message: 'Sesi telah berakhir. Silakan masuk kembali.'
    });
  }

  const themeMode = body.theme_mode === 'dark' ? 'dark' : 'light';
  db.prepare('UPDATE users SET theme_mode = ? WHERE id = ?').run(themeMode, sessionData.user.id);

  return res.sendJson(200, {
    success: true,
    message: `Tema berhasil diubah ke mode ${themeMode === 'dark' ? 'Gelap' : 'Terang'}.`,
    theme_mode: themeMode
  });
}

/**
 * Handle GET /api/auth/accounts (List of PIC accounts for quick selection/testing on login screen)
 */
function handleGetAccountsList(req, res) {
  const accounts = db.prepare(`
    SELECT
      u.username,
      u.full_name,
      s.code AS section_code,
      s.name AS section_name,
      s.short_name AS section_short_name
    FROM users u
    JOIN sections s ON u.section_id = s.id
    ORDER BY s.sort_order ASC
  `).all();

  return res.sendJson(200, {
    success: true,
    accounts
  });
}

module.exports = {
  handleLogin,
  handleLogout,
  handleGetMe,
  handleUpdateTheme,
  handleGetAccountsList
};

