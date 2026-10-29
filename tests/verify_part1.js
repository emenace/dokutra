const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { db, initializeDatabase } = require('../src/config/database');
const {
  handleLogin,
  handleLogout,
  handleGetMe,
  handleUpdateTheme,
  handleGetAccountsList
} = require('../src/routes/authRoutes');
const { handleGetSections } = require('../src/routes/sectionRoutes');

/**
 * Helper to invoke route handlers in-process without opening a TCP socket
 */
function invokeHandler(handler, { method = 'GET', url = '/', headers = {}, body = {} } = {}) {
  const req = {
    method,
    url,
    headers
  };

  let statusCode = 200;
  const responseHeaders = {};
  let jsonPayload = null;

  const res = {
    setHeader(name, value) {
      responseHeaders[name.toLowerCase()] = value;
    },
    sendJson(code, payload) {
      statusCode = code;
      jsonPayload = payload;
    }
  };

  handler(req, res, body);

  return {
    statusCode,
    headers: responseHeaders,
    body: jsonPayload
  };
}

async function runPart1Verification() {
  console.log('=== Starting Part 1 Verification Suite ===');

  initializeDatabase();

  // 1. Verify SQLite file exists
  const dbFile = path.join(__dirname, '..', 'data', 'dokutra.sqlite');
  assert.ok(fs.existsSync(dbFile), 'SQLite database file data/dokutra.sqlite must exist');
  console.log('[PASS] SQLite database file data/dokutra.sqlite created.');

  // 2. Verify 11 sections are seeded properly
  const sectionsRes = invokeHandler(handleGetSections);
  assert.strictEqual(sectionsRes.statusCode, 200);
  assert.strictEqual(sectionsRes.body.sections.length, 11, 'Exactly 11 sections must be seeded');
  assert.strictEqual(sectionsRes.body.dropdown_targets.length, 10, '10 sections must be in dropdown_targets (excluding HUMAS)');

  const humasSection = sectionsRes.body.sections.find((s) => s.code === 'HUMAS');
  assert.ok(humasSection, 'HUMAS section must exist');
  assert.strictEqual(humasSection.is_dropdown_target, 0, 'HUMAS must have is_dropdown_target = 0');
  console.log('[PASS] 11 office sections verified (10 dropdown targets + 1 Humas auto-bridge).');

  // 3. Verify 11 PIC user accounts exist
  const accountsRes = invokeHandler(handleGetAccountsList);
  assert.strictEqual(accountsRes.statusCode, 200);
  assert.strictEqual(accountsRes.body.accounts.length, 11, '11 default PIC user accounts must be seeded');
  console.log('[PASS] 11 PIC user accounts verified.');

  // 4. Test unauthenticated /api/auth/me
  const unauthRes = invokeHandler(handleGetMe);
  assert.strictEqual(unauthRes.statusCode, 401, 'Unauthenticated /api/auth/me should return 401');

  // 5. Test Login with PAPKI PIC account
  const loginRes = invokeHandler(handleLogin, {
    method: 'POST',
    body: { username: 'papki', password: '123456' }
  });
  assert.strictEqual(loginRes.statusCode, 200, 'Login with valid credentials should return 200');
  assert.strictEqual(loginRes.body.success, true);
  assert.strictEqual(loginRes.body.user.section_code, 'PAPKI');

  const setCookieHeader = loginRes.headers['set-cookie'];
  assert.ok(setCookieHeader, 'Set-Cookie header must be returned on login');
  assert.ok(setCookieHeader.includes('dokutra_sid='), 'Cookie must contain dokutra_sid');
  assert.ok(setCookieHeader.includes('Max-Age=21600'), 'Cookie Max-Age must be 21600 seconds (6 hours)');
  console.log('[PASS] Login endpoint & 6-hour persistent cookie (Max-Age=21600) verified.');

  const cookiePair = setCookieHeader.split(';')[0];

  // 6. Test authenticated /api/auth/me using the 6-hour cookie
  const meRes = invokeHandler(handleGetMe, {
    headers: { cookie: cookiePair }
  });
  assert.strictEqual(meRes.statusCode, 200, 'Authenticated /api/auth/me should return 200');
  assert.strictEqual(meRes.body.authenticated, true);
  assert.strictEqual(meRes.body.user.username, 'papki');
  console.log('[PASS] Session persistence via /api/auth/me verified.');

  // 7. Test updating user theme preference (Light/Dark mode saved in user configuration)
  const themeRes = invokeHandler(handleUpdateTheme, {
    method: 'PUT',
    headers: { cookie: cookiePair },
    body: { theme_mode: 'dark' }
  });
  assert.strictEqual(themeRes.statusCode, 200);
  const updatedUser = db.prepare('SELECT theme_mode FROM users WHERE username = ?').get('papki');
  assert.strictEqual(updatedUser.theme_mode, 'dark', 'User theme_mode in SQLite should be updated to dark');

  // Reset back to light for clean state
  invokeHandler(handleUpdateTheme, {
    method: 'PUT',
    headers: { cookie: cookiePair },
    body: { theme_mode: 'light' }
  });
  console.log('[PASS] User theme configuration persistence in SQLite verified.');

  // 8. Test logout
  const logoutRes = invokeHandler(handleLogout, {
    method: 'POST',
    headers: { cookie: cookiePair }
  });
  assert.strictEqual(logoutRes.statusCode, 200);

  const afterLogoutRes = invokeHandler(handleGetMe, {
    headers: { cookie: cookiePair }
  });
  assert.strictEqual(afterLogoutRes.statusCode, 401, 'Session must be invalidated after logout');
  console.log('[PASS] Logout and session destruction verified.');

  console.log('=== All Part 1 Checks Passed Successfully! ===');
}

runPart1Verification().catch((err) => {
  console.error('[FAIL] Part 1 Verification Failed:', err);
  process.exit(1);
});
