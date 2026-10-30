/**
 * DOKUTRA Frontend Application Controller
 * Part 1, Part 2 & Part 3: Auth, 6-Hour Session, Responsive App Shell, Kemenag Green Theme,
 * Create New Tracker Document & Smart Routing Engine Preview
 */
const SAVED_CREDENTIALS_KEY = 'dokutra_saved_device_accounts_v1';
const LOCAL_THEME_KEY = 'dokutra_theme_mode';

const state = {
  currentUser: null,
  sessionExpiresAt: null,
  sections: [],
  dropdownTargets: [],
  documents: [],
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
const previewOriginNode = document.getElementById('previewOriginNode');
const sectionsTableContainer = document.getElementById('sectionsTableContainer');
const trackedDocsCountBadge = document.getElementById('trackedDocsCountBadge');
const trackedDocsListContainer = document.getElementById('trackedDocsListContainer');

// DOM Elements - Create New Tracker Form (Part 3)
const createFormOriginBadge = document.getElementById('createFormOriginBadge');
const createDocForm = document.getElementById('createDocForm');
const createDocAlert = document.getElementById('createDocAlert');
const createDocSuccess = document.getElementById('createDocSuccess');
const docDateInput = document.getElementById('docDateInput');
const docNumberInput = document.getElementById('docNumberInput');
const docSubjectInput = document.getElementById('docSubjectInput');
const docClassificationSelect = document.getElementById('docClassificationSelect');
const docDescriptionInput = document.getElementById('docDescriptionInput');
const docTrackingIdInput = document.getElementById('docTrackingIdInput');
const docTargetSectionSelect = document.getElementById('docTargetSectionSelect');
const smartRoutePreviewBox = document.getElementById('smartRoutePreviewBox');
const smartRouteExplanation = document.getElementById('smartRouteExplanation');
const smartRouteNodesContainer = document.getElementById('smartRouteNodesContainer');

const SUN_ICON_SVG = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
const MOON_ICON_SVG = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

/**
 * Switch active navigation tab in the authenticated App Shell
 * @param {string} targetTabId
 */
function switchTab(targetTabId) {
  state.activeTab = targetTabId;

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

  document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.target === targetTabId);
  });

  document.querySelectorAll('.bottom-nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.target === targetTabId);
  });

  // When opening Create Document Tab, refresh auto-generated ID and today's date
  if (targetTabId === 'createDocTab') {
    prepareCreateDocumentForm();
  }

  // When opening Dashboard Tab, reload tracked documents
  if (targetTabId === 'dashboardTab' && state.currentUser) {
    loadTrackedDocuments();
  }
}

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
 * Populate the "Teruskan Dokumen Ke" dropdown with the 10 eligible target sections (excluding Humas)
 */
function populateTargetSectionDropdown() {
  if (!docTargetSectionSelect) return;

  const currentVal = docTargetSectionSelect.value;
  docTargetSectionSelect.innerHTML = '<option value="">-- Pilih Seksi Tujuan --</option>';

  state.dropdownTargets.forEach((sec) => {
    // Allow forwarding to any of the 10 dropdown target sections
    const opt = document.createElement('option');
    opt.value = String(sec.id);
    const isSelf = state.currentUser && sec.id === state.currentUser.section_id;
    opt.textContent = isSelf ? `${sec.name} (Seksi Anda)` : sec.name;
    docTargetSectionSelect.appendChild(opt);
  });

  if (currentVal) {
    docTargetSectionSelect.value = currentVal;
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

    populateTargetSectionDropdown();

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
 * Prepare the "Buat Pelacakan Dokumen Baru" form:
 * - Auto-select today's date
 * - Fetch fresh auto-generated Document Tracking ID (YYYYMMDD-HHMMSS-SECTIONCODE)
 */
async function prepareCreateDocumentForm() {
  if (!state.currentUser) return;

  if (createFormOriginBadge) {
    createFormOriginBadge.textContent = `Dari: ${state.currentUser.section_short_name}`;
  }

  // Set fallback today date immediately
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (docDateInput && !docDateInput.value) {
    docDateInput.value = localToday;
  }

  try {
    const res = await fetch('/api/documents/generate-id');
    const data = await res.json();
    if (data.success) {
      if (docTrackingIdInput) {
        docTrackingIdInput.value = data.doc_tracking_id;
      }
      if (docDateInput) {
        docDateInput.value = data.default_doc_date || localToday;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch preview ID:', err);
  }
}

/**
 * Fetch and render Smart Route preview when user changes "Teruskan Dokumen Ke"
 */
async function updateSmartRoutePreview() {
  const targetSectionId = docTargetSectionSelect.value;
  if (!targetSectionId) {
    smartRoutePreviewBox.classList.add('hidden');
    smartRouteNodesContainer.innerHTML = '';
    return;
  }

  try {
    const res = await fetch(`/api/documents/route-preview?target_section_id=${encodeURIComponent(targetSectionId)}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      smartRoutePreviewBox.classList.add('hidden');
      return;
    }

    smartRoutePreviewBox.classList.remove('hidden');
    smartRouteExplanation.textContent = data.explanation;
    smartRouteNodesContainer.innerHTML = '';

    const chain = data.full_route_chain || [];
    chain.forEach((sec, idx) => {
      const pill = document.createElement('span');
      const isBridge = idx > 0 && idx < chain.length - 1;
      const isFinal = idx === chain.length - 1;
      pill.className = `route-hop-pill ${isBridge ? 'hop-bridge' : ''} ${isFinal ? 'hop-target' : ''}`;
      pill.textContent = `${idx + 1}. ${sec.short_name}`;
      smartRouteNodesContainer.appendChild(pill);

      if (idx < chain.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'route-hop-arrow';
        arrow.textContent = '→';
        smartRouteNodesContainer.appendChild(arrow);
      }
    });
  } catch (err) {
    console.warn('Failed to load smart route preview:', err);
  }
}

/**
 * Load tracked documents for the dashboard list
 */
async function loadTrackedDocuments() {
  if (!trackedDocsListContainer) return;

  try {
    const res = await fetch('/api/documents');
    const data = await res.json();
    if (!data.success) return;

    state.documents = data.documents || [];
    if (trackedDocsCountBadge) {
      trackedDocsCountBadge.textContent = `${state.documents.length} Dokumen`;
    }

    if (state.documents.length === 0) {
      trackedDocsListContainer.innerHTML = `
        <div class="empty-state-box">
          <h4>Belum Ada Dokumen Terlacak</h4>
          <p>Gunakan menu "Buat Pelacakan" untuk mendaftarkan dokumen pertama dari seksi Anda.</p>
        </div>
      `;
      return;
    }

    trackedDocsListContainer.innerHTML = '';
    state.documents.forEach((doc) => {
      const card = document.createElement('div');
      card.className = 'tracked-doc-item';

      const routeSummary = doc.pending_section_short_name
        ? `${doc.current_section_short_name} → Menunggu ${doc.pending_section_short_name}`
        : `Posisi: ${doc.current_section_short_name}`;

      card.innerHTML = `
        <div class="tracked-doc-top">
          <span class="doc-id-mono">${doc.doc_tracking_id}</span>
          <div class="doc-badges-group">
            <span class="sifat-badge sifat-${doc.classification}">${doc.classification}</span>
            <span class="status-pill">${doc.current_status}</span>
          </div>
        </div>
        <div class="tracked-doc-subject">${doc.subject}</div>
        <div class="tracked-doc-meta">
          <span>Tgl: ${doc.doc_date}</span>
          ${doc.doc_number ? `<span>No: ${doc.doc_number}</span>` : ''}
          <span>Asal: ${doc.origin_section_short_name}</span>
          <span>Alur: <strong>${routeSummary}</strong></span>
        </div>
      `;
      trackedDocsListContainer.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load tracked documents:', err);
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

  loadSectionsList();
  switchTab('dashboardTab');
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

// Event Listeners - Theme Toggles
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

// Event Listeners - Navigation Tabs
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

// Event Listeners - Create New Document Form (Part 3)
if (docTargetSectionSelect) {
  docTargetSectionSelect.addEventListener('change', updateSmartRoutePreview);
}

if (createDocForm) {
  createDocForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    createDocAlert.classList.add('hidden');
    createDocSuccess.classList.add('hidden');

    const payload = {
      doc_date: docDateInput.value,
      doc_number: docNumberInput.value.trim(),
      subject: docSubjectInput.value.trim(),
      classification: docClassificationSelect.value,
      description: docDescriptionInput.value.trim(),
      doc_tracking_id: docTrackingIdInput.value.trim(),
      target_section_id: Number(docTargetSectionSelect.value)
    };

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        createDocAlert.textContent = result.message || 'Gagal menyimpan pelacakan dokumen.';
        createDocAlert.classList.remove('hidden');
        return;
      }

      createDocSuccess.innerHTML = `
        <strong>Berhasil!</strong> ID Dokumen <code>${result.document.doc_tracking_id}</code> telah dibuat.<br/>
        <span>${result.routing_explanation}</span>
      `;
      createDocSuccess.classList.remove('hidden');

      // Reset fillable inputs and generate a fresh ID for the next document
      docNumberInput.value = '';
      docSubjectInput.value = '';
      docClassificationSelect.value = 'Biasa';
      docDescriptionInput.value = '';
      docTargetSectionSelect.value = '';
      smartRoutePreviewBox.classList.add('hidden');

      await prepareCreateDocumentForm();
      await loadTrackedDocuments();
    } catch {
      createDocAlert.textContent = 'Terjadi gangguan jaringan saat menyimpan dokumen.';
      createDocAlert.classList.remove('hidden');
    }
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
