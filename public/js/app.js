/**
 * DOKUTRA Frontend Application Controller
 * Part 1, Part 2, Part 3 & Part 4:
 * - Auth & 6-Hour Session
 * - Responsive App Shell & Kemenag Green Theme (Light/Dark Mode)
 * - Create New Tracker Document & Smart Routing Engine
 * - Big Incoming Document Notification & Review Workflow (Diterima, Diproses, Diteruskan)
 */
const SAVED_CREDENTIALS_KEY = 'dokutra_saved_device_accounts_v1';
const LOCAL_THEME_KEY = 'dokutra_theme_mode';

const state = {
  currentUser: null,
  sessionExpiresAt: null,
  sections: [],
  dropdownTargets: [],
  documents: [],
  incomingDocuments: [],
  activeHeldDocuments: [],
  currentReviewDoc: null,
  showArchivedDocs: false,
  activeTab: 'dashboardTab'
};

// DOM Elements - Layout & Navigation
const appHeader = document.getElementById('appHeader');
const mobileBottomNav = document.getElementById('mobileBottomNav');
const headerSectionBadge = document.getElementById('headerSectionBadge');
const desktopInboxBadge = document.getElementById('desktopInboxBadge');
const mobileInboxBadge = document.getElementById('mobileInboxBadge');
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

// DOM Elements - Big Incoming Notification Banner (Part 4)
const bigIncomingAlertBanner = document.getElementById('bigIncomingAlertBanner');
const bigIncomingTitle = document.getElementById('bigIncomingTitle');
const bigIncomingSubtitle = document.getElementById('bigIncomingSubtitle');
const bigIncomingActionBtn = document.getElementById('bigIncomingActionBtn');

// DOM Elements - Dashboard & Sections
const activeSectionCodeBadge = document.getElementById('activeSectionCodeBadge');
const activeUserFullName = document.getElementById('activeUserFullName');
const activeSectionFullName = document.getElementById('activeSectionFullName');
const activeSectionDesc = document.getElementById('activeSectionDesc');
const statActiveSection = document.getElementById('statActiveSection');
const previewOriginNode = document.getElementById('previewOriginNode');
const sectionsTableContainer = document.getElementById('sectionsTableContainer');
const trackedDocsSectionTitle = document.getElementById('trackedDocsSectionTitle');
const trackedDocsSectionSubtitle = document.getElementById('trackedDocsSectionSubtitle');
const trackedDocsCountBadge = document.getElementById('trackedDocsCountBadge');
const toggleArchiveDocsBtn = document.getElementById('toggleArchiveDocsBtn');
const toggleArchiveDocsLabel = document.getElementById('toggleArchiveDocsLabel');
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

// DOM Elements - Inbox Tab & Review Modal (Part 4)
const inboxPendingCountBadge = document.getElementById('inboxPendingCountBadge');
const inboxPendingListContainer = document.getElementById('inboxPendingListContainer');
const inboxActiveHeldCountBadge = document.getElementById('inboxActiveHeldCountBadge');
const inboxActiveHeldListContainer = document.getElementById('inboxActiveHeldListContainer');

const reviewModalOverlay = document.getElementById('reviewModalOverlay');
const closeReviewModalBtn = document.getElementById('closeReviewModalBtn');
const cancelReviewModalBtn = document.getElementById('cancelReviewModalBtn');
const reviewModalDocId = document.getElementById('reviewModalDocId');
const reviewModalSubject = document.getElementById('reviewModalSubject');
const reviewModalDate = document.getElementById('reviewModalDate');
const reviewModalNumber = document.getElementById('reviewModalNumber');
const reviewModalClassification = document.getElementById('reviewModalClassification');
const reviewModalOrigin = document.getElementById('reviewModalOrigin');
const reviewModalCurrentLoc = document.getElementById('reviewModalCurrentLoc');
const reviewModalFinalTarget = document.getElementById('reviewModalFinalTarget');
const reviewModalInitialDesc = document.getElementById('reviewModalInitialDesc');
const reviewModalLogsList = document.getElementById('reviewModalLogsList');
const reviewModalAlert = document.getElementById('reviewModalAlert');
const reviewActionForm = document.getElementById('reviewActionForm');
const reviewDocDbIdInput = document.getElementById('reviewDocDbIdInput');
const reviewForwardTargetGroup = document.getElementById('reviewForwardTargetGroup');
const reviewTargetSectionSelect = document.getElementById('reviewTargetSectionSelect');
const reviewPlannedRouteHint = document.getElementById('reviewPlannedRouteHint');
const reviewNoteInput = document.getElementById('reviewNoteInput');
const statusCardTolak = document.getElementById('statusCardTolak');
const statusCardTeruskan = document.getElementById('statusCardTeruskan');
const statusCardTeruskanProtokol = document.getElementById('statusCardTeruskanProtokol');
const statusCardProtokolTitle = document.getElementById('statusCardProtokolTitle');
const statusCardProtokolDesc = document.getElementById('statusCardProtokolDesc');
const statusCardTeruskanSeksi = document.getElementById('statusCardTeruskanSeksi');
const statusCardSeksiTitle = document.getElementById('statusCardSeksiTitle');
const statusCardSeksiDesc = document.getElementById('statusCardSeksiDesc');
const statusCardSelesai = document.getElementById('statusCardSelesai');
const statusCardSelesaiTitle = document.getElementById('statusCardSelesaiTitle');
const statusCardSelesaiDesc = document.getElementById('statusCardSelesaiDesc');
const reviewReadOnlyBox = document.getElementById('reviewReadOnlyBox');
const reviewReadOnlyStatusInfo = document.getElementById('reviewReadOnlyStatusInfo');
const closeReadOnlyModalBtn = document.getElementById('closeReadOnlyModalBtn');

// DOM Elements - Small Popup Feedback Modal
const popupFeedbackOverlay = document.getElementById('popupFeedbackOverlay');
const popupFeedbackCard = document.getElementById('popupFeedbackCard');
const popupFeedbackIconBox = document.getElementById('popupFeedbackIconBox');
const popupFeedbackTitle = document.getElementById('popupFeedbackTitle');
const popupFeedbackMessage = document.getElementById('popupFeedbackMessage');
const popupFeedbackCloseBtn = document.getElementById('popupFeedbackCloseBtn');

const CHECK_ICON_SVG = '<svg class="ui-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const ALERT_ICON_SVG = '<svg class="ui-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

/**
 * Show small centered popup modal for success or error feedback
 * @param {'success' | 'error'} type
 * @param {string} title
 * @param {string} htmlMessage
 */
function showFeedbackPopup(type, title, htmlMessage) {
  if (!popupFeedbackOverlay) return;
  const isSuccess = type === 'success';
  popupFeedbackCard.className = `popup-feedback-card ${isSuccess ? 'is-success' : 'is-error'}`;
  popupFeedbackIconBox.innerHTML = isSuccess ? CHECK_ICON_SVG : ALERT_ICON_SVG;
  popupFeedbackTitle.textContent = title;
  popupFeedbackMessage.innerHTML = htmlMessage;
  popupFeedbackOverlay.classList.remove('hidden');
  if (popupFeedbackCloseBtn) {
    popupFeedbackCloseBtn.focus();
  }
}

function closeFeedbackPopup() {
  if (!popupFeedbackOverlay) return;
  popupFeedbackOverlay.classList.add('hidden');
}

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

  if (targetTabId === 'createDocTab') {
    prepareCreateDocumentForm();
  }

  if ((targetTabId === 'dashboardTab' || targetTabId === 'inboxTab') && state.currentUser) {
    loadInboxAndNotifications();
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
 * Populate the "Teruskan Dokumen Ke" dropdowns (both in Create Form and Review Modal)
 */
function populateTargetSectionDropdowns() {
  const selects = [docTargetSectionSelect, reviewTargetSectionSelect].filter(Boolean);

  selects.forEach((sel) => {
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">-- Pilih Seksi Tujuan --</option>';

    state.dropdownTargets.forEach((sec) => {
      const opt = document.createElement('option');
      opt.value = String(sec.id);
      const isSelf = state.currentUser && sec.id === state.currentUser.section_id;
      opt.textContent = isSelf ? `${sec.name} (Seksi Anda)` : sec.name;
      sel.appendChild(opt);
    });

    if (currentVal) {
      sel.value = currentVal;
    }
  });
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

    populateTargetSectionDropdowns();

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
 * Prepare the "Buat Pelacakan Dokumen Baru" form
 */
async function prepareCreateDocumentForm() {
  if (!state.currentUser) return;

  if (createFormOriginBadge) {
    createFormOriginBadge.textContent = `Dari: ${state.currentUser.section_short_name}`;
  }

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
 * Load Incoming Documents, update Big Notification Banner on Dashboard, and render Inbox Tab lists (Part 4)
 */
async function loadInboxAndNotifications() {
  if (!state.currentUser) return;

  try {
    const res = await fetch('/api/documents/inbox');
    const data = await res.json();
    if (!res.ok || !data.success) return;

    state.incomingDocuments = data.incoming_documents || [];
    state.activeHeldDocuments = data.active_section_documents || [];
    const incomingCount = state.incomingDocuments.length;

    // 1. Update Navigation Badges
    if (desktopInboxBadge) {
      desktopInboxBadge.textContent = String(incomingCount);
      desktopInboxBadge.classList.toggle('hidden', incomingCount === 0);
    }
    if (mobileInboxBadge) {
      mobileInboxBadge.textContent = String(incomingCount);
      mobileInboxBadge.classList.toggle('hidden', incomingCount === 0);
    }

    // 2. Update Big Incoming Notification Banner on Home Dashboard
    if (bigIncomingAlertBanner) {
      if (incomingCount > 0) {
        const latestDoc = state.incomingDocuments[0];
        bigIncomingTitle.textContent =
          incomingCount === 1
            ? `1 Dokumen Masuk (Otomatis Diterima) di ${state.currentUser.section_short_name}: "${latestDoc.subject}"`
            : `Ada ${incomingCount} Dokumen Masuk (Otomatis Diterima) di Seksi ${state.currentUser.section_short_name}!`;
        bigIncomingSubtitle.textContent =
          incomingCount === 1
            ? `ID: ${latestDoc.doc_tracking_id}. Klik tombol untuk me-review dan memilih tindak lanjut (Ditolak, Menunggu, atau Teruskan).`
            : `Klik tombol untuk me-review dokumen masuk dan memilih tindak lanjut (Ditolak, Menunggu, atau Teruskan).`;
        bigIncomingAlertBanner.classList.remove('hidden');
      } else {
        bigIncomingAlertBanner.classList.add('hidden');
      }
    }

    // 3. Render Inbox Pending List
    if (inboxPendingCountBadge) {
      inboxPendingCountBadge.textContent = `${incomingCount} Perlu Review`;
    }
    if (inboxPendingListContainer) {
      if (incomingCount === 0) {
        inboxPendingListContainer.innerHTML = `
          <div class="empty-state-box">
            <h4>Tidak Ada Dokumen Masuk Baru</h4>
            <p>Seluruh dokumen yang masuk ke seksi Anda sudah direview.</p>
          </div>
        `;
      } else {
        inboxPendingListContainer.innerHTML = '';
        state.incomingDocuments.forEach((doc) => {
          inboxPendingListContainer.appendChild(createActionableDocCard(doc, true));
        });
      }
    }

    // 4. Render Active Held at Section List (Menunggu / Ditolak)
    if (inboxActiveHeldCountBadge) {
      inboxActiveHeldCountBadge.textContent = `${state.activeHeldDocuments.length} Di Seksi Ini`;
    }
    if (inboxActiveHeldListContainer) {
      if (state.activeHeldDocuments.length === 0) {
        inboxActiveHeldListContainer.innerHTML = `
          <div class="empty-state-box">
            <h4>Tidak Ada Dokumen Berstatus Menunggu / Ditolak</h4>
            <p>Dokumen yang telah Anda review dengan status "Menunggu" atau "Ditolak" akan tampil di sini.</p>
          </div>
        `;
      } else {
        inboxActiveHeldListContainer.innerHTML = '';
        state.activeHeldDocuments.forEach((doc) => {
          inboxActiveHeldListContainer.appendChild(createActionableDocCard(doc, false));
        });
      }
    }
  } catch (err) {
    console.error('Failed to load inbox and notifications:', err);
  }
}

/**
 * Create a document card with a "Review & Tindak Lanjut" button
 * @param {object} doc
 * @param {boolean} isIncomingPending
 */
function createActionableDocCard(doc, isIncomingPending) {
  const card = document.createElement('div');
  card.className = 'tracked-doc-item';

  let displayStatus = doc.current_status;
  if (doc.current_status === 'DITERIMA' || doc.current_status === 'MENUNGGU') {
    displayStatus = 'DITERIMA & MENUNGGU';
  } else if (doc.current_status === 'SELESAI') {
    displayStatus = 'SELESAI (ARSIP)';
  }

  const statusLabel = isIncomingPending
    ? doc.is_returned_signed_to_origin
      ? `TELAH DITANDATANGANI (Klik Selesai di ${doc.current_section_short_name})`
      : `DITERIMA & MENUNGGU (Perlu Review di ${doc.current_section_short_name})`
    : `${displayStatus} di ${doc.current_section_short_name}`;

  const actionBtnText = doc.is_returned_signed_to_origin
    ? 'Tandai Selesai & Arsipkan'
    : isIncomingPending
    ? 'Review Dokumen Masuk'
    : 'Perbarui Status / Teruskan';

  card.innerHTML = `
    <div class="tracked-doc-top">
      <span class="doc-id-mono">${doc.doc_tracking_id}</span>
      <div class="doc-badges-group">
        <span class="sifat-badge sifat-${doc.classification}">${doc.classification}</span>
        <span class="status-pill">${statusLabel}</span>
      </div>
    </div>
    <div class="tracked-doc-subject">${doc.subject}</div>
    <div class="tracked-doc-meta">
      <span>Tgl: ${doc.doc_date}</span>
      ${doc.doc_number ? `<span>No: ${doc.doc_number}</span>` : ''}
      <span>Asal Awal: ${doc.origin_section_short_name}</span>
      <span>Lokasi: <strong>${doc.current_section_short_name}</strong></span>
    </div>
    <div class="doc-card-actions">
      <button type="button" class="btn-review-card">
        ${actionBtnText}
      </button>
    </div>
  `;

  const btn = card.querySelector('.btn-review-card');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openReviewModal(doc);
  });

  card.addEventListener('click', () => openReviewModal(doc));
  return card;
}

/**
 * Open the Review & Tindak Lanjut Modal for an incoming or active section document
 * @param {object} doc
 */
function openReviewModal(doc) {
  state.currentReviewDoc = doc;
  reviewModalAlert.classList.add('hidden');
  reviewDocDbIdInput.value = String(doc.id);
  reviewModalDocId.textContent = doc.doc_tracking_id;
  reviewModalSubject.textContent = doc.subject;
  reviewModalDate.textContent = doc.doc_date;
  reviewModalNumber.textContent = doc.doc_number || '-';
  reviewModalClassification.textContent = doc.classification;
  reviewModalOrigin.textContent = doc.origin_section_short_name;
  reviewModalCurrentLoc.textContent = doc.current_section_short_name;
  reviewModalFinalTarget.textContent = doc.final_target_section_short_name || '-';
  reviewModalInitialDesc.textContent = doc.description || 'Tidak ada keterangan tambahan.';
  reviewNoteInput.value = '';

  // Render logs history in slim single-line format with colorization:
  // - Red (.log-red): DITOLAK (Tolak)
  // - Blue (.log-blue): DITERUSKAN (Teruskan)
  // - Green (.log-green): DIBUAT, DITERIMA, MENUNGGU, DIPROSES (Diterima & Proses)
  reviewModalLogsList.innerHTML = '';
  (doc.logs || []).forEach((log) => {
    const item = document.createElement('div');
    let colorClass = 'log-green';
    let badgeText = log.action_status;

    if (log.action_status === 'DITOLAK') {
      colorClass = 'log-red';
      badgeText = 'DITOLAK';
    } else if (log.action_status === 'DITERUSKAN') {
      colorClass = 'log-blue';
      badgeText = 'DITERUSKAN';
    } else if (log.action_status === 'SELESAI') {
      colorClass = 'log-green';
      badgeText = 'SELESAI & ARSIP';
    } else if (log.action_status === 'DITERIMA' || log.action_status === 'MENUNGGU' || log.action_status === 'DIPROSES') {
      colorClass = 'log-green';
      badgeText = 'DITERIMA & MENUNGGU';
    } else if (log.action_status === 'DIBUAT') {
      colorClass = 'log-green';
      badgeText = 'DIBUAT';
    }

    item.className = `review-log-item ${colorClass}`;
    const routeText =
      log.from_section_id === log.to_section_id
        ? log.from_section_short_name
        : `${log.from_section_short_name} → ${log.to_section_short_name}`;
    item.innerHTML = `
      <strong>[${badgeText}] ${routeText}</strong>
      <span>— ${log.note || '-'} (${log.action_by_name})</span>
    `;
    reviewModalLogsList.appendChild(item);
  });

  // Check if current logged-in section can perform an action on this document
  // or if it is being viewed in read-only mode (e.g. source section checking progress at another section, or archived doc)
  const isActionableByMe =
    state.currentUser &&
    doc.current_status !== 'SELESAI' &&
    (doc.pending_section_id === state.currentUser.section_id ||
      (doc.current_section_id === state.currentUser.section_id && doc.pending_section_id === null));

  if (!isActionableByMe) {
    if (reviewActionForm) reviewActionForm.classList.add('hidden');
    if (reviewReadOnlyBox) {
      reviewReadOnlyBox.classList.remove('hidden');
      const currentForwardedSectionName =
        doc.current_section_name || doc.current_section_short_name || doc.pending_section_short_name || '-';
      const statusText =
        doc.current_status === 'SELESAI'
          ? `SELESAI & DIARSIPKAN di ${doc.current_section_short_name}`
          : doc.current_status === 'DITERIMA' || doc.current_status === 'MENUNGGU'
          ? `DITERIMA & MENUNGGU di ${doc.current_section_short_name}`
          : `${doc.current_status} di ${doc.current_section_short_name}`;
      if (reviewReadOnlyStatusInfo) {
        reviewReadOnlyStatusInfo.innerHTML = `
          <strong>Status Pergerakan Dokumen Saat Ini:</strong> <code>${statusText}</code><br/>
          <span>${
            doc.current_status === 'SELESAI'
              ? 'Dokumen ini telah selesai ditandatangani dan tersimpan di dalam Arsip.'
              : `Dokumen sedang berada di seksi <strong>${currentForwardedSectionName}</strong>.`
          }</span>
        `;
      }
    }
    reviewModalOverlay.classList.remove('hidden');
    return;
  }

  if (reviewActionForm) reviewActionForm.classList.remove('hidden');
  if (reviewReadOnlyBox) reviewReadOnlyBox.classList.add('hidden');

  // Configure role-specific review action cards:
  // - When document is sent back from Humas to origin section after "ditandatangani" (doc.is_returned_signed_to_origin === true):
  //   ONLY ONE button selection is shown: "Selesai" (SELESAI, green card).
  // - Otherwise:
  //   - Standard sections: [Tolak, Teruskan]
  //   - KASUBBAG: [Tolak, Teruskan, "Paraf / Tandatangan dan Teruskan ke Protokol" (auto-selects Humas Protokol & hides dropdown)]
  //   - KEPALA: [Tolak, "Tandatangan dan Teruskan ke Protokol" (auto-selects Humas Protokol & hides dropdown)]
  //   - HUMAS (when receiving back from KASUBBAG or KEPALA): [Tolak, "Teruskan ke Seksi" (auto-selects source section & hides dropdown)]
  const userSectionCode = state.currentUser ? state.currentUser.section_code : '';
  const isReturnAtHumas = userSectionCode === 'HUMAS' && Boolean(doc.is_return_from_pimpinan);
  const isReturnedSignedAtOrigin =
    Boolean(doc.is_returned_signed_to_origin) &&
    state.currentUser &&
    doc.origin_section_id === state.currentUser.section_id;

  if (isReturnedSignedAtOrigin) {
    if (statusCardTolak) statusCardTolak.classList.add('hidden');
    if (statusCardTeruskan) statusCardTeruskan.classList.add('hidden');
    if (statusCardTeruskanProtokol) statusCardTeruskanProtokol.classList.add('hidden');
    if (statusCardTeruskanSeksi) statusCardTeruskanSeksi.classList.add('hidden');
    if (statusCardSelesai) {
      statusCardSelesai.classList.remove('hidden');
      if (statusCardSelesaiTitle) {
        statusCardSelesaiTitle.textContent = 'Selesai';
      }
      if (statusCardSelesaiDesc) {
        statusCardSelesaiDesc.textContent =
          'Dokumen telah ditandatangani dan dikembalikan dari Humas Protokol ke seksi Anda. Klik simpan untuk menandai Selesai & memindahkan ke Arsip.';
      }
    }
  } else {
    if (statusCardTolak) statusCardTolak.classList.remove('hidden');
    if (statusCardSelesai) statusCardSelesai.classList.add('hidden');

    if (userSectionCode === 'KASUBBAG' || userSectionCode === 'KEPALA') {
      // Disable normal Teruskan on both Kasubbag and Kepala; only show "Paraf / Tandatangan dan Teruskan ke Protokol"
      if (statusCardTeruskan) statusCardTeruskan.classList.add('hidden');
      if (statusCardTeruskanProtokol) {
        statusCardTeruskanProtokol.classList.remove('hidden');
        if (statusCardProtokolTitle) {
          statusCardProtokolTitle.textContent = 'Paraf / Tandatangan dan Teruskan ke Protokol';
        }
        if (statusCardProtokolDesc) {
          statusCardProtokolDesc.textContent = 'Otomatis memilih Humas Protokol dan menyembunyikan pilihan dropdown.';
        }
      }
      if (statusCardTeruskanSeksi) statusCardTeruskanSeksi.classList.add('hidden');
    } else if (isReturnAtHumas) {
      if (statusCardTeruskan) statusCardTeruskan.classList.add('hidden');
      if (statusCardTeruskanProtokol) statusCardTeruskanProtokol.classList.add('hidden');
      if (statusCardTeruskanSeksi) {
        statusCardTeruskanSeksi.classList.remove('hidden');
        if (statusCardSeksiTitle) {
          statusCardSeksiTitle.textContent = 'Teruskan ke Seksi';
        }
        if (statusCardSeksiDesc) {
          statusCardSeksiDesc.textContent = `Otomatis memilih seksi asal (${doc.origin_section_short_name}) tanpa dropdown.`;
        }
      }
    } else {
      if (statusCardTeruskan) statusCardTeruskan.classList.remove('hidden');
      if (statusCardTeruskanProtokol) statusCardTeruskanProtokol.classList.add('hidden');
      if (statusCardTeruskanSeksi) statusCardTeruskanSeksi.classList.add('hidden');
    }
  }

  // Pre-select default radio button
  const radios = document.querySelectorAll('input[name="review_action_status"]');
  let defaultAction = 'TERUSKAN';
  if (isReturnedSignedAtOrigin) {
    defaultAction = 'SELESAI';
  } else if (doc.current_status === 'DITOLAK') {
    defaultAction = 'DITOLAK';
  } else if (userSectionCode === 'KASUBBAG' || userSectionCode === 'KEPALA') {
    defaultAction = 'TERUSKAN_PROTOKOL';
  } else if (isReturnAtHumas) {
    defaultAction = 'TERUSKAN_SEKSI';
  }

  radios.forEach((r) => {
    r.checked = r.value === defaultAction;
  });

  // Configure planned route pre-selection if standard Teruskan is chosen
  populateTargetSectionDropdowns();
  if (doc.final_target_section_id) {
    reviewTargetSectionSelect.value = String(doc.final_target_section_id);
  } else {
    reviewTargetSectionSelect.value = '';
  }

  syncReviewActionVisibility();
  reviewModalOverlay.classList.remove('hidden');
}

/**
 * Close Review Modal
 */
function closeReviewModal() {
  state.currentReviewDoc = null;
  reviewModalOverlay.classList.add('hidden');
}

/**
 * Show/hide the "Teruskan Dokumen Ke" dropdown inside the Review Modal:
 * - Shown ONLY when standard "TERUSKAN" is selected.
 * - Hidden when "DITOLAK", "TERUSKAN_PROTOKOL" (auto-selects Humas Protokol), or "TERUSKAN_SEKSI" (auto-selects source section) is selected.
 */
function syncReviewActionVisibility() {
  const selectedRadio = document.querySelector('input[name="review_action_status"]:checked');
  const actionVal = selectedRadio ? selectedRadio.value : 'TERUSKAN';

  if (actionVal === 'TERUSKAN') {
    reviewForwardTargetGroup.classList.remove('hidden');
    const doc = state.currentReviewDoc;
    if (doc && Array.isArray(doc.planned_route) && doc.planned_route.length > 0) {
      reviewPlannedRouteHint.classList.remove('hidden');
      reviewPlannedRouteHint.innerHTML = `
        <strong>Rute Berantai Aktif:</strong> Dokumen ini memiliki jadwal rute otomatis menuju <code>${doc.planned_route.join(' → ')}</code>.
        Biarkan pilihan dropdown di atas sesuai tujuan akhir untuk melanjutkan rute otomatis, atau ubah jika ingin mengalihkan ke seksi lain.
      `;
    } else {
      reviewPlannedRouteHint.classList.add('hidden');
    }
  } else {
    // Hide dropdown selection for DITOLAK, TERUSKAN_PROTOKOL, and TERUSKAN_SEKSI
    reviewForwardTargetGroup.classList.add('hidden');
  }
}

/**
 * Load tracked documents for the dashboard list and render active vs archived view
 */
async function loadTrackedDocuments() {
  if (!trackedDocsListContainer) return;

  try {
    const res = await fetch('/api/documents');
    const data = await res.json();
    if (!data.success) return;

    state.documents = data.documents || [];
    renderTrackedDocumentsList();
  } catch (err) {
    console.error('Failed to load tracked documents:', err);
  }
}

/**
 * Render Daftar Dokumen Terlacak (Active vs Arsip) on the Dashboard
 */
function renderTrackedDocumentsList() {
  if (!trackedDocsListContainer) return;

  const activeDocs = (state.documents || []).filter((d) => d.current_status !== 'SELESAI');
  const archivedDocs = (state.documents || []).filter((d) => d.current_status === 'SELESAI');
  const displayedDocs = state.showArchivedDocs ? archivedDocs : activeDocs;

  if (trackedDocsSectionTitle) {
    trackedDocsSectionTitle.textContent = state.showArchivedDocs
      ? 'Arsip Dokumen Selesai (Seksi Anda)'
      : 'Daftar Dokumen Terlacak (Seksi Anda)';
  }
  if (trackedDocsSectionSubtitle) {
    trackedDocsSectionSubtitle.textContent = state.showArchivedDocs
      ? 'Daftar dokumen yang telah selesai ditandatangani dan disimpan ke dalam Arsip. Klik dokumen untuk melihat riwayat.'
      : 'Klik pada dokumen mana saja untuk melihat status terkini dan riwayat perjalanan dokumen.';
  }

  if (trackedDocsCountBadge) {
    trackedDocsCountBadge.textContent = state.showArchivedDocs
      ? `${archivedDocs.length} Arsip`
      : `${activeDocs.length} Dokumen Aktif`;
  }

  if (toggleArchiveDocsBtn && toggleArchiveDocsLabel) {
    if (state.showArchivedDocs) {
      toggleArchiveDocsBtn.classList.add('active');
      toggleArchiveDocsLabel.textContent = `Lihat Dokumen Aktif (${activeDocs.length})`;
    } else {
      toggleArchiveDocsBtn.classList.remove('active');
      toggleArchiveDocsLabel.textContent = `Arsip (${archivedDocs.length})`;
    }
  }

  if (displayedDocs.length === 0) {
    trackedDocsListContainer.innerHTML = state.showArchivedDocs
      ? `
        <div class="empty-state-box">
          <h4>Belum Ada Dokumen di Arsip</h4>
          <p>Dokumen yang telah kembali ke seksi asal dan ditandai "Selesai" akan otomatis tersimpan di Arsip ini.</p>
        </div>
      `
      : `
        <div class="empty-state-box">
          <h4>Belum Ada Dokumen Aktif Terlacak</h4>
          <p>Gunakan menu "Buat Pelacakan" untuk mendaftarkan dokumen baru, atau klik tombol "Arsip" untuk melihat dokumen yang telah selesai.</p>
        </div>
      `;
    return;
  }

  trackedDocsListContainer.innerHTML = '';
  displayedDocs.forEach((doc) => {
    const card = document.createElement('div');
    card.className = 'tracked-doc-item clickable-card';

    const isActionableByMe =
      state.currentUser &&
      doc.current_status !== 'SELESAI' &&
      (doc.pending_section_id === state.currentUser.section_id ||
        (doc.current_section_id === state.currentUser.section_id && doc.pending_section_id === null));

    let displayStatus = doc.current_status;
    if (doc.current_status === 'DITERIMA' || doc.current_status === 'MENUNGGU') {
      displayStatus = 'DITERIMA & MENUNGGU';
    } else if (doc.current_status === 'SELESAI') {
      displayStatus = 'SELESAI (ARSIP)';
    }

    const routeSummary = `Lokasi: ${doc.current_section_short_name} (${displayStatus})`;
    const btnText = doc.is_returned_signed_to_origin
      ? 'Selesaikan & Arsipkan'
      : isActionableByMe
      ? 'Review / Tindak Lanjut'
      : 'Lihat Status & Riwayat';

    card.innerHTML = `
      <div class="tracked-doc-top">
        <span class="doc-id-mono">${doc.doc_tracking_id}</span>
        <div class="doc-badges-group">
          <span class="sifat-badge sifat-${doc.classification}">${doc.classification}</span>
          <span class="status-pill">${displayStatus}</span>
        </div>
      </div>
      <div class="tracked-doc-subject">${doc.subject}</div>
      <div class="tracked-doc-meta">
        <span>Tgl: ${doc.doc_date}</span>
        ${doc.doc_number ? `<span>No: ${doc.doc_number}</span>` : ''}
        <span>Asal: ${doc.origin_section_short_name}</span>
        <span><strong>${routeSummary}</strong></span>
      </div>
      <div class="doc-card-actions">
        <button type="button" class="btn-review-card">
          ${btnText}
        </button>
      </div>
    `;

    const btn = card.querySelector('.btn-review-card');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openReviewModal(doc);
      });
    }

    card.addEventListener('click', () => {
      openReviewModal(doc);
    });

    trackedDocsListContainer.appendChild(card);
  });
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
  reviewModalOverlay.classList.add('hidden');
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

// Event Listeners - Big Incoming Notification Banner (Part 4)
if (bigIncomingActionBtn) {
  bigIncomingActionBtn.addEventListener('click', () => {
    if (state.incomingDocuments.length === 1) {
      openReviewModal(state.incomingDocuments[0]);
    } else {
      switchTab('inboxTab');
    }
  });
}

// Event Listeners - Review Modal (Part 4)
document.querySelectorAll('input[name="review_action_status"]').forEach((radio) => {
  radio.addEventListener('change', syncReviewActionVisibility);
});

if (closeReviewModalBtn) {
  closeReviewModalBtn.addEventListener('click', closeReviewModal);
}
if (cancelReviewModalBtn) {
  cancelReviewModalBtn.addEventListener('click', closeReviewModal);
}
if (closeReadOnlyModalBtn) {
  closeReadOnlyModalBtn.addEventListener('click', closeReviewModal);
}
if (toggleArchiveDocsBtn) {
  toggleArchiveDocsBtn.addEventListener('click', () => {
    state.showArchivedDocs = !state.showArchivedDocs;
    renderTrackedDocumentsList();
  });
}

if (reviewActionForm) {
  reviewActionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    reviewModalAlert.classList.add('hidden');

    const docId = reviewDocDbIdInput.value;
    const selectedRadio = document.querySelector('input[name="review_action_status"]:checked');
    const actionStatus = selectedRadio ? selectedRadio.value : 'TERUSKAN';
    const note = reviewNoteInput.value.trim();
    let targetSectionId = reviewTargetSectionSelect.value ? Number(reviewTargetSectionSelect.value) : null;

    // Auto-select Humas Protokol when TERUSKAN_PROTOKOL is chosen (Kasubbag / Kepala)
    if (actionStatus === 'TERUSKAN_PROTOKOL') {
      const humasSec = (state.sections || []).find((s) => s.code === 'HUMAS');
      targetSectionId = humasSec ? humasSec.id : null;
    }
    // Auto-select Source Section when TERUSKAN_SEKSI is chosen (Humas returning from Kasubbag / Kepala)
    else if (actionStatus === 'TERUSKAN_SEKSI' && state.currentReviewDoc) {
      targetSectionId = state.currentReviewDoc.origin_section_id;
    }

    if (actionStatus === 'TERUSKAN' && !targetSectionId) {
      reviewModalAlert.textContent = 'Silakan pilih seksi tujuan pada dropdown "Teruskan Dokumen Ke".';
      reviewModalAlert.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_status: actionStatus,
          note,
          target_section_id: targetSectionId
        })
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        reviewModalAlert.textContent = result.message || 'Gagal menyimpan status review dokumen.';
        reviewModalAlert.classList.remove('hidden');
        return;
      }

      closeReviewModal();
      if (actionStatus === 'SELESAI') {
        showFeedbackPopup(
          'success',
          'Dokumen Selesai & Diarsipkan!',
          `Dokumen <code>${result.document.doc_tracking_id}</code> telah ditandai <strong>Selesai</strong> dan dipindahkan ke dalam menu <strong>Arsip</strong>.`
        );
      }
      await loadInboxAndNotifications();
      await loadTrackedDocuments();
    } catch {
      reviewModalAlert.textContent = 'Terjadi gangguan jaringan saat menyimpan review dokumen.';
      reviewModalAlert.classList.remove('hidden');
    }
  });
}

// Event Listeners - Create New Document Form (Part 3)
if (popupFeedbackCloseBtn) {
  popupFeedbackCloseBtn.addEventListener('click', closeFeedbackPopup);
}
if (popupFeedbackOverlay) {
  popupFeedbackOverlay.addEventListener('click', (e) => {
    if (e.target === popupFeedbackOverlay) {
      closeFeedbackPopup();
    }
  });
}

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
        const errMsg = result.message || 'Gagal menyimpan pelacakan dokumen.';
        createDocAlert.textContent = errMsg;
        createDocAlert.classList.remove('hidden');
        showFeedbackPopup('error', 'Gagal Menyimpan Dokumen', errMsg);
        return;
      }

      const successHtml = `ID Dokumen <code>${result.document.doc_tracking_id}</code> telah dibuat.<br/><span>${result.routing_explanation}</span>`;
      createDocSuccess.innerHTML = `<strong>Berhasil!</strong> ${successHtml}`;
      createDocSuccess.classList.remove('hidden');

      showFeedbackPopup('success', 'Berhasil!', successHtml);

      docNumberInput.value = '';
      docSubjectInput.value = '';
      docClassificationSelect.value = 'Biasa';
      docDescriptionInput.value = '';
      docTargetSectionSelect.value = '';
      smartRoutePreviewBox.classList.add('hidden');

      await prepareCreateDocumentForm();
      await loadInboxAndNotifications();
      await loadTrackedDocuments();
    } catch {
      const netErr = 'Terjadi gangguan jaringan saat menyimpan dokumen.';
      createDocAlert.textContent = netErr;
      createDocAlert.classList.remove('hidden');
      showFeedbackPopup('error', 'Gangguan Jaringan', netErr);
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
