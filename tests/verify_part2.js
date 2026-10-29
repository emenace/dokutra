const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { initializeDatabase } = require('../src/config/database');
const {
  handleLogin,
  handleGetMe,
  handleUpdateTheme
} = require('../src/routes/authRoutes');
const { handleGetSections } = require('../src/routes/sectionRoutes');

function invokeHandler(handler, { method = 'GET', url = '/', headers = {}, body = {} } = {}) {
  const req = { method, url, headers };
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
  return { statusCode, headers: responseHeaders, body: jsonPayload };
}

async function runPart2Verification() {
  console.log('=== Starting Part 2 Verification Suite ===');

  initializeDatabase();

  // 1. Verify UI Shell HTML contains Mobile Bottom Nav, Desktop Nav, Theme Config Cards, and 4 Tabs
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('id="mobileBottomNav"'), 'Mobile bottom navigation bar must exist');
  assert.ok(indexHtml.includes('id="desktopNav"'), 'Desktop top navigation must exist');
  assert.ok(indexHtml.includes('id="dashboardTab"'), 'Dashboard tab pane must exist');
  assert.ok(indexHtml.includes('id="createDocTab"'), 'Create Document tab pane must exist');
  assert.ok(indexHtml.includes('id="inboxTab"'), 'Inbox tab pane must exist');
  assert.ok(indexHtml.includes('id="sectionsTab"'), 'Sections & Theme tab pane must exist');
  assert.ok(indexHtml.includes('id="selectLightModeBtn"'), 'Light mode selector card must exist');
  assert.ok(indexHtml.includes('id="selectDarkModeBtn"'), 'Dark mode selector card must exist');
  assert.ok(!indexHtml.includes('Sesi Cookie Aktif'), 'Cookie display info must remain hidden from user UI');
  console.log('[PASS] Mobile Webview & PC Desktop App Shell HTML verified.');

  // 2. Verify CSS contains Kemenag Green variables, Dark Mode rules, and Desktop Media Queries
  const cssContent = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
  assert.ok(cssContent.includes('--kemenag-primary: #006837'), 'Light mode Kemenag Green (#006837) must exist');
  assert.ok(cssContent.includes('html[data-theme="dark"]'), 'Dark mode theme selector must exist');
  assert.ok(cssContent.includes('@media (min-width: 768px)'), 'Desktop responsive media query must exist');
  console.log('[PASS] Kemenag Green palette, Dark/Light mode styles, and PC responsive media queries verified.');

  // 3. Verify /api/sections separates 11 total sections and 10 dropdown targets (excluding HUMAS)
  const sectionsRes = invokeHandler(handleGetSections);
  assert.strictEqual(sectionsRes.statusCode, 200);
  assert.strictEqual(sectionsRes.body.sections.length, 11, 'Total sections must be 11');
  assert.strictEqual(sectionsRes.body.dropdown_targets.length, 10, 'Dropdown target sections must be 10');
  assert.ok(
    !sectionsRes.body.dropdown_targets.some((s) => s.code === 'HUMAS'),
    'HUMAS must not appear in dropdown_targets'
  );
  console.log('[PASS] /api/sections endpoint separation (11 total vs 10 dropdown targets) verified.');

  // 4. Verify theme persistence across login -> update theme -> re-fetch /api/auth/me
  const loginRes = invokeHandler(handleLogin, {
    method: 'POST',
    body: { username: 'kepegawaian', password: '123456' }
  });
  const cookiePair = loginRes.headers['set-cookie'].split(';')[0];

  const setDarkRes = invokeHandler(handleUpdateTheme, {
    method: 'PUT',
    headers: { cookie: cookiePair },
    body: { theme_mode: 'dark' }
  });
  assert.strictEqual(setDarkRes.statusCode, 200);
  assert.strictEqual(setDarkRes.body.theme_mode, 'dark');

  const meDarkRes = invokeHandler(handleGetMe, {
    headers: { cookie: cookiePair }
  });
  assert.strictEqual(meDarkRes.body.user.theme_mode, 'dark', 'User session must return saved dark theme');

  // Restore to light mode
  invokeHandler(handleUpdateTheme, {
    method: 'PUT',
    headers: { cookie: cookiePair },
    body: { theme_mode: 'light' }
  });
  console.log('[PASS] User theme configuration persistence across sessions verified.');

  console.log('=== All Part 2 Checks Passed Successfully! ===');
}

runPart2Verification().catch((err) => {
  console.error('[FAIL] Part 2 Verification Failed:', err);
  process.exit(1);
});

