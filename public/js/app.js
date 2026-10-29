/**
 * DOKUTRA Frontend Application Controller
 * Part 1 & Part 2: Auth, 6-Hour Session, Responsive App Shell, Kemenag Green Theme & User Theme Config
 */
const SAVED_CREDENTIALS_KEY = 'dokutra_saved_device_accounts_v1';
const LOCAL_THEME_KEY = 'dokutra_theme_mode';

const state = {
  currentUser: null,
  sessionExpiresAt: null,
  sections: [],
  dropdownTargets: [],
  activeTab: 'dashboardTab'
};

// DOM Elements - Layout & Navigation
const appHeader = document.getElementById('appHeader');
const mobileBottomNav = document.getElementById('mobileBottomNav');
const headerSectionBadge = document.getElementById('headerSectionBadge');
const loginView = document.getElementById('loginView');
const sessionView = document.getElementById('sessionView');

// DOM Elements - Login
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const rememberDeviceCheckbox = document.getElementById('rememberDeviceCheckbox');
const loginAlert = document.getElementById('loginAlert');
const savedDevicesSection = document.getElementById('savedDevicesSection');
const savedAccountsList = document.getElementById('savedAccountsList');
const allPicAccountsList = document.getElementById('allPicAccountsList');

// DOM Elements - Theme & Actions
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const currentThemeStatusBadge = document.getElementById('currentThemeStatusBadge');
const selectLightModeBtn = document.getElementById('selectLightModeBtn');
const selectDarkModeBtn = document.getElementById('selectDarkModeBtn');
const logoutBtn = document.getElementById('logoutBtn');
const quickCreateDocBtn = document.getElementById('quickCreateDocBtn');

// DOM Elements - Dashboard & Sections
const activeSectionCodeBadge = document.getElementById('activeSectionCodeBadge');
const activeUserFullName = document.getElementById('activeUserFullName');
const activeSectionFullName = document.getElementById('activeSectionFullName');
const activeSectionDesc = document.getElementById('activeSectionDesc');
const statActiveSection = document.getElementById('statActiveSection');
const statTotalSections = document.getElementById('statTotalSections');
const statDropdownCount = document.getElementById('statDropdownCount');
const previewOriginNode = document.getElementById('previewOriginNode');
const createTabDropdownPreview = document.getElementById('createTabDropdownPreview');
const sectionsTableContainer = document.getElementById('sectionsTableContainer');

/**
 * Switch active navigation tab in the authenticated App Shell
 * @param {string} targetTabId
 */
function switchTab(targetTabId) {
  state.activeTab = targetTabId;

  // Toggle tab panes
  const panes = document.querySelectorAll('.tab-pane');
  panes.forEach((pane) => {
    if (pane.id === targetTabId) {
      pane.classList.remove('hidden');
      pane.classList.add('active');
    } else {
      pane.classList.add('hidden');
      pane.classList.remove('active');
    }
  });

  // Update desktop top nav buttons
  document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.target === targetTabId);
  });

  // Update mobile bottom nav buttons
  document.querySelectorAll('.bottom-nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.target === targetTabId);
  });
}

const SUN_ICON_SVG = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
const MOON_ICON_SVG = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

/**
 * Apply Light or Dark theme to HTML document and update UI indicators
 * @param {'light' | 'dark'} themeMode
 */
function applyTheme(themeMode) {
  const mode = themeMode === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem(LOCAL_THEME_KEY, mode);

  if (themeIcon) {
    themeIcon.innerHTML = mode === 'dark' ? SUN_ICON_SVG : MOON_ICON_SVG;
  }
  if (currentThemeStatusBadge) {
    currentThemeStatusBadge.textContent = mode === 'dark' ? 'Mode Gelap Aktif' : 'Mode Terang Aktif';
  }
  if (selectLightModeBtn && selectDarkModeBtn) {
    selectLightModeBtn.classList.toggle('active', mode === 'light');
    selectDarkModeBtn.classList.toggle('active', mode === 'dark');
  }
}

/**
 * Persist theme selection to backend user profile and apply immediately
 * @param {'light' | 'dark'} nextTheme
 */
async function updateAndSaveUserTheme(nextTheme) {
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
}

/**
 * Load saved device credentials from localStorage
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
 * Load and display the 11 office sections and 10 dropdown targets
 */
async function loadSectionsList() {
  try {
    const res = await fetch('/api/sections');
    const data = await res.json();
    if (!data.success) return;

    state.sections = data.sections || [];
    state.dropdownTargets = data.dropdown_targets || [];

    if (statTotalSections) {
      statTotalSections.textContent = `${state.sections.length} Seksi`;
    }
    if (statDropdownCount) {
      statDropdownCount.textContent = `${state.dropdownTargets.length} Seksi`;
    }
    if (createTabDropdownPreview) {
      const names = state.dropdownTargets.map((s) => s.short_name).join(', ');
      createTabDropdownPreview.textContent = `Pilihan tersedia: ${names} (Humas Protokol otomatis menjadi jembatan).`;
    }

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
  mobileBottomNav.classList.remove('hidden');
  sessionView.classList.remove('hidden');

  activeSectionCodeBadge.textContent = `SEKSI: ${user.section_short_name}`;
  if (headerSectionBadge) {
    headerSectionBadge.textContent = `PIC: ${user.section_short_name}`;
  }
  if (statActiveSection) {
    statActiveSection.textContent = user.section_short_name;
  }
  if (previewOriginNode) {
    previewOriginNode.textContent = user.section_short_name;
  }

  activeUserFullName.textContent = user.full_name;
  activeSectionFullName.textContent = user.section_name;
  activeSectionDesc.textContent = user.section_description || '';

  switchTab('dashboardTab');
  loadSectionsList();
}

/**
 * Show login view
 */
function showLoginView() {
  state.currentUser = null;
  appHeader.classList.add('hidden');
  mobileBottomNav.classList.add('hidden');
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
  } catch {
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

// Event Listeners - Login
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

// Event Listeners - Theme Toggles (Header icon + Theme Config Cards)
themeToggleBtn.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  updateAndSaveUserTheme(nextTheme);
});

if (selectLightModeBtn) {
  selectLightModeBtn.addEventListener('click', () => updateAndSaveUserTheme('light'));
}
if (selectDarkModeBtn) {
  selectDarkModeBtn.addEventListener('click', () => updateAndSaveUserTheme('dark'));
}

// Event Listeners - Navigation Tabs (Desktop Top Nav & Mobile Bottom Nav)
document.querySelectorAll('.nav-tab-btn, .bottom-nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetTab = btn.dataset.target;
    if (targetTab) {
      switchTab(targetTab);
    }
  });
});

if (quickCreateDocBtn) {
  quickCreateDocBtn.addEventListener('click', () => {
    switchTab('createDocTab');
  });
}

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
