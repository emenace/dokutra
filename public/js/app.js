/**
 * DOKUTRA Frontend Application Controller (Part 1: Auth, Device Credential Storage, & Session Management)
 */
const SAVED_CREDENTIALS_KEY = 'dokutra_saved_device_accounts_v1';
const LOCAL_THEME_KEY = 'dokutra_theme_mode';

const state = {
  currentUser: null,
  sessionExpiresAt: null,
  sections: []
};

// DOM Elements
const appHeader = document.getElementById('appHeader');
const loginView = document.getElementById('loginView');
const sessionView = document.getElementById('sessionView');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const rememberDeviceCheckbox = document.getElementById('rememberDeviceCheckbox');
const loginAlert = document.getElementById('loginAlert');
const savedDevicesSection = document.getElementById('savedDevicesSection');
const savedAccountsList = document.getElementById('savedAccountsList');
const allPicAccountsList = document.getElementById('allPicAccountsList');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const logoutBtn = document.getElementById('logoutBtn');

const activeSectionCodeBadge = document.getElementById('activeSectionCodeBadge');
const activeUserFullName = document.getElementById('activeUserFullName');
const activeSectionFullName = document.getElementById('activeSectionFullName');
const activeSectionDesc = document.getElementById('activeSectionDesc');
const sectionsTableContainer = document.getElementById('sectionsTableContainer');

/**
 * Apply Light or Dark theme to HTML document and save locally
 * @param {'light' | 'dark'} themeMode
 */
function applyTheme(themeMode) {
  const mode = themeMode === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem(LOCAL_THEME_KEY, mode);
  if (themeIcon) {
    themeIcon.textContent = mode === 'dark' ? '☀️' : '🌙';
  }
}

/**
 * Load saved device credentials from localStorage
 * @returns {Array<{username: string, password: string, sectionName: string, fullName: string}>}
 */
function getSavedDeviceAccounts() {
  try {
    const raw = localStorage.getItem(SAVED_CREDENTIALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save or update user credentials on this device
 */
function saveAccountOnDevice(username, password, sectionName, fullName) {
  try {
    const existing = getSavedDeviceAccounts().filter(
      (item) => item.username.toLowerCase() !== username.toLowerCase()
    );
    existing.unshift({
      username,
      password,
      sectionName: sectionName || username,
      fullName: fullName || username,
      savedAt: Date.now()
    });
    // Keep up to 5 recent accounts on the device
    localStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify(existing.slice(0, 5)));
  } catch (err) {
    console.warn('Unable to save credentials to localStorage:', err);
  }
}

/**
 * Remove a saved account from this device
 */
function removeSavedAccountFromDevice(username) {
  const filtered = getSavedDeviceAccounts().filter(
    (item) => item.username.toLowerCase() !== username.toLowerCase()
  );
  localStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify(filtered));
  renderSavedDeviceAccounts();
}

/**
 * Render list of saved accounts on the login screen for 1-tap login
 */
function renderSavedDeviceAccounts() {
  const saved = getSavedDeviceAccounts();
  if (saved.length === 0) {
    savedDevicesSection.classList.add('hidden');
    savedAccountsList.innerHTML = '';
    return;
  }

  savedDevicesSection.classList.remove('hidden');
  savedAccountsList.innerHTML = '';

  saved.forEach((acc) => {
    const row = document.createElement('div');
    row.className = 'saved-account-item';

    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'saved-account-btn';
    selectBtn.innerHTML = `
      <strong>${acc.sectionName} (${acc.username})</strong>
      <span>Ketuk untuk masuk otomatis</span>
    `;
    selectBtn.addEventListener('click', () => {
      usernameInput.value = acc.username;
      passwordInput.value = acc.password;
      submitLogin(acc.username, acc.password, true);
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-saved-btn';
    removeBtn.title = 'Hapus dari perangkat ini';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      removeSavedAccountFromDevice(acc.username);
    });

    row.appendChild(selectBtn);
    row.appendChild(removeBtn);
    savedAccountsList.appendChild(row);
  });

  // Pre-fill the most recently used account into the form inputs
  if (!usernameInput.value && saved[0]) {
    usernameInput.value = saved[0].username;
    passwordInput.value = saved[0].password;
  }
}

/**
 * Load all 11 PIC accounts for the helper accordion on login view
 */
async function loadAvailablePicAccounts() {
  try {
    const res = await fetch('/api/auth/accounts');
    const data = await res.json();
    if (!data.success || !Array.isArray(data.accounts)) return;

    allPicAccountsList.innerHTML = '';
    data.accounts.forEach((acc) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pic-chip-btn';
      btn.innerHTML = `
        <strong>${acc.section_short_name}</strong>
        <span>User: ${acc.username}</span>
      `;
      btn.addEventListener('click', () => {
        usernameInput.value = acc.username;
        passwordInput.value = '123456';
        loginAlert.classList.add('hidden');
      });
      allPicAccountsList.appendChild(btn);
    });
  } catch (err) {
    console.error('Failed to load PIC accounts helper:', err);
  }
}

/**
 * Load and display the 11 office sections inside the authenticated view
 */
async function loadSectionsList() {
  try {
    const res = await fetch('/api/sections');
    const data = await res.json();
    if (!data.success) return;

    state.sections = data.sections || [];
    sectionsTableContainer.innerHTML = '';

    state.sections.forEach((sec) => {
      const item = document.createElement('div');
      item.className = 'section-row-item';

      const isDropdown = sec.is_dropdown_target === 1;
      const badgeHtml = isDropdown
        ? '<span class="dropdown-status-tag tag-dropdown-yes">Muncul di Dropdown Tujuan</span>'
        : '<span class="dropdown-status-tag tag-dropdown-bridge">Jembatan Otomatis (Humas)</span>';

      item.innerHTML = `
        <div class="section-row-info">
          <strong>${sec.sort_order}. ${sec.name}</strong>
          <span>${sec.description || ''}</span>
        </div>
        ${badgeHtml}
      `;
      sectionsTableContainer.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load sections:', err);
  }
}

/**
 * Show authenticated dashboard view
 */
function showAuthenticatedView(user, sessionExpiresAt) {
  state.currentUser = user;
  state.sessionExpiresAt = sessionExpiresAt;

  applyTheme(user.theme_mode || 'light');

  loginView.classList.add('hidden');
  appHeader.classList.remove('hidden');
  sessionView.classList.remove('hidden');

  activeSectionCodeBadge.textContent = `SEKSI: ${user.section_short_name}`;
  activeUserFullName.textContent = user.full_name;
  activeSectionFullName.textContent = user.section_name;
  activeSectionDesc.textContent = user.section_description || '';

  loadSectionsList();
}

/**
 * Show login view
 */
function showLoginView() {
  state.currentUser = null;
  appHeader.classList.add('hidden');
  sessionView.classList.add('hidden');
  loginView.classList.remove('hidden');
  renderSavedDeviceAccounts();
}

/**
 * Submit login request to backend API
 */
async function submitLogin(username, password, rememberDevice) {
  loginAlert.classList.add('hidden');
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      loginAlert.textContent = result.message || 'Gagal masuk. Periksa kembali akun Anda.';
      loginAlert.classList.remove('hidden');
      return;
    }

    if (rememberDevice) {
      saveAccountOnDevice(
        result.user.username,
        password,
        result.user.section_short_name,
        result.user.full_name
      );
    }

    // Store in browser Credential Management API if supported by phone webview
    if (window.PasswordCredential && rememberDevice) {
      try {
        const cred = new window.PasswordCredential({
          id: username,
          password: password,
          name: result.user.full_name
        });
        navigator.credentials.store(cred).catch(() => {});
      } catch {
        // Ignore if Webview restricts PasswordCredential constructor
      }
    }

    showAuthenticatedView(result.user, result.sessionExpiresAt);
  } catch (err) {
    loginAlert.textContent = 'Tidak dapat terhubung ke server DOKUTRA.';
    loginAlert.classList.remove('hidden');
  }
}

/**
 * Check if an active 6-hour session cookie already exists on page load
 */
async function checkExistingSession() {
  const savedLocalTheme = localStorage.getItem(LOCAL_THEME_KEY) || 'light';
  applyTheme(savedLocalTheme);

  try {
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      const data = await response.json();
      if (data.authenticated && data.user) {
        showAuthenticatedView(data.user, data.sessionExpiresAt);
        return;
      }
    }
  } catch {
    // Offline or not authenticated
  }

  showLoginView();
}

// Event Listeners
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const rememberDevice = rememberDeviceCheckbox.checked;
  submitLogin(username, password, rememberDevice);
});

togglePasswordBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  togglePasswordBtn.textContent = isPassword ? 'Sembunyikan' : 'Lihat';
});

themeToggleBtn.addEventListener('click', async () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);

  if (state.currentUser) {
    state.currentUser.theme_mode = nextTheme;
    try {
      await fetch('/api/auth/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_mode: nextTheme })
      });
    } catch (err) {
      console.warn('Failed to persist theme to server:', err);
    }
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    showLoginView();
  }
});

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  loadAvailablePicAccounts();
  checkExistingSession();
});

