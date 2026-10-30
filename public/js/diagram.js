/**
 * DOKUTRA Interactive Diagram Visualizer (Part 5)
 * Supports two modes:
 * 1. Focused Diagram Mode (Default):
 *    Displays ONLY the office sections involved in the selected document's trajectory
 *    (Origin -> Visited Sections -> Current Location -> Scheduled Route Nodes).
 *    Uninvolved sections are hidden to keep Phone Webview & PC screens uncluttered.
 * 2. All Sections Mode (Read-Only Toggle):
 *    Displays all 11 office sections of Kantor Kemenag Kota Metro in a comprehensive grid
 *    showing all active documents currently stationed at each section.
 */
(function () {
  const diagramState = {
    mode: 'focused', // 'focused' | 'all_sections'
    selectedDocumentId: null,
    focusedDocument: null,
    sectionDocuments: [],
    allSectionsMap: [],
    onOpenDocumentModal: null
  };

  function formatStatusLabel(status) {
    if (status === 'DITERIMA' || status === 'MENUNGGU') {
      return 'DITERIMA & MENUNGGU';
    }
    if (status === 'SELESAI') {
      return 'SELESAI & ARSIP';
    }
    return status || '-';
  }

  /**
   * Fetch latest diagram data from /api/documents/diagram
   * @param {number|null} [preferredDocId]
   */
  async function refreshDiagram(preferredDocId = null) {
    if (preferredDocId !== null && preferredDocId !== undefined) {
      diagramState.selectedDocumentId = Number(preferredDocId);
    }

    const query = diagramState.selectedDocumentId
      ? `?document_id=${encodeURIComponent(diagramState.selectedDocumentId)}`
      : '';

    try {
      const res = await fetch(`/api/documents/diagram${query}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      diagramState.focusedDocument = data.focused_document || null;
      diagramState.sectionDocuments = data.section_documents || [];
      diagramState.allSectionsMap = data.all_sections_map || [];

      if (diagramState.focusedDocument) {
        diagramState.selectedDocumentId = diagramState.focusedDocument.id;
      }

      renderDiagramView();
    } catch (err) {
      console.error('Failed to load diagram data:', err);
    }
  }

  /**
   * Toggle between Focused Mode and All Sections (Read-Only) Mode
   */
  function toggleDiagramMode() {
    diagramState.mode = diagramState.mode === 'focused' ? 'all_sections' : 'focused';
    renderDiagramView();
  }

  /**
   * Select a specific document to focus on the diagram
   * @param {number} docId
   */
  function selectFocusedDocument(docId) {
    diagramState.selectedDocumentId = Number(docId);
    diagramState.mode = 'focused';
    refreshDiagram(diagramState.selectedDocumentId);
  }

  /**
   * Render the active diagram mode (Focused vs All Sections)
   */
  function renderDiagramView() {
    const toggleBtn = document.getElementById('toggleAllSectionsDiagramBtn');
    const modeSubtitle = document.getElementById('diagramModeSubtitle');
    const focusedContainer = document.getElementById('focusedDiagramViewContainer');
    const allSectionsContainer = document.getElementById('allSectionsDiagramViewContainer');

    if (!focusedContainer || !allSectionsContainer) return;

    if (diagramState.mode === 'all_sections') {
      focusedContainer.classList.add('hidden');
      allSectionsContainer.classList.remove('hidden');
      if (toggleBtn) {
        toggleBtn.textContent = 'Mode Fokus Dokumen';
        toggleBtn.classList.add('active-mode-btn');
      }
      if (modeSubtitle) {
        modeSubtitle.textContent =
          'Mode Semua Seksi (Read-Only): Menampilkan seluruh 11 seksi Kantor Kemenag Kota Metro beserta dokumen aktif di tiap seksi.';
      }
      renderAllSectionsGrid();
    } else {
      allSectionsContainer.classList.add('hidden');
      focusedContainer.classList.remove('hidden');
      if (toggleBtn) {
        toggleBtn.textContent = 'Tampilkan Semua Seksi';
        toggleBtn.classList.remove('active-mode-btn');
      }
      if (modeSubtitle) {
        modeSubtitle.textContent =
          'Mode Fokus: Hanya menampilkan seksi yang dilalui oleh dokumen terpilih agar tampilan tetap ringkas dan jelas.';
      }
      renderFocusedDiagram();
    }
  }

  /**
   * Render Focused Diagram (only sections participating in the selected document's trajectory)
   */
  function renderFocusedDiagram() {
    const selectorBar = document.getElementById('diagramDocSelectorBar');
    const docSelect = document.getElementById('diagramDocumentSelect');
    const openDetailBtn = document.getElementById('diagramOpenDetailBtn');
    const canvas = document.getElementById('focusedDiagramCanvas');
    const caption = document.getElementById('focusedDiagramCaption');

    if (!canvas) return;

    const docs = diagramState.sectionDocuments || [];
    const doc = diagramState.focusedDocument;

    if (docs.length === 0 || !doc) {
      if (selectorBar) selectorBar.classList.add('hidden');
      const userSectionName =
        (window.dokutraCurrentUserSectionName && window.dokutraCurrentUserSectionName()) || 'Seksi Anda';
      canvas.innerHTML = `
        <div class="diagram-flow-preview">
          <div class="flow-node active-origin">
            <span class="flow-step-tag">Seksi Pengirim</span>
            <strong id="previewOriginNode">${userSectionName}</strong>
            <small>Siap Membuat Dokumen</small>
          </div>
          <div class="flow-arrow">➔</div>
          <div class="flow-node bridge-node">
            <span class="flow-step-tag">Jembatan Otomatis</span>
            <strong>Humas Protokol</strong>
            <small>Jika Tujuan Kasubbag / Kepala</small>
          </div>
          <div class="flow-arrow">➔</div>
          <div class="flow-node target-node">
            <span class="flow-step-tag">Tujuan Dokumen</span>
            <strong>Seksi Tujuan</strong>
            <small>Otomatis Diterima &amp; Menunggu</small>
          </div>
        </div>
      `;
      if (caption) {
        caption.innerHTML =
          '<strong>Mode Fokus Aktif:</strong> Belum ada dokumen aktif di seksi Anda. Gunakan menu <em>"Buat Pelacakan"</em> untuk mendaftarkan dokumen baru.';
      }
      return;
    }

    if (selectorBar && docSelect) {
      selectorBar.classList.remove('hidden');
      docSelect.innerHTML = '';
      docs.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = String(d.id);
        const st = formatStatusLabel(d.current_status);
        opt.textContent = `${d.doc_tracking_id} — ${d.subject} [${st} @ ${d.current_section_short_name}]`;
        if (d.id === doc.id) {
          opt.selected = true;
        }
        docSelect.appendChild(opt);
      });
    }

    if (openDetailBtn) {
      openDetailBtn.onclick = () => {
        if (typeof diagramState.onOpenDocumentModal === 'function') {
          diagramState.onOpenDocumentModal(doc);
        }
      };
    }

    const nodes = Array.isArray(doc.trajectory_nodes) ? doc.trajectory_nodes : [];
    const isReturningDirection = Boolean(
      doc.is_returning_direction ||
        doc.is_return_from_pimpinan ||
        doc.is_returned_signed_to_origin ||
        doc.current_status === 'SELESAI'
    );
    canvas.innerHTML = '';

    const flowWrapper = document.createElement('div');
    flowWrapper.className = 'diagram-flow-preview focused-trajectory-flow';

    nodes.forEach((node, idx) => {
      const nodeEl = document.createElement('div');
      let stateClass = 'node-upcoming';
      let badgeHtml = '<span class="diagram-node-status status-upcoming">Jadwal Rute</span>';

      if (node.is_current) {
        if (doc.current_status === 'DITOLAK') {
          stateClass = 'node-current-rejected';
          badgeHtml = '<span class="diagram-node-status status-rejected">LOKASI SAAT INI: DITOLAK</span>';
        } else if (doc.current_status === 'SELESAI') {
          stateClass = 'node-current-archived';
          badgeHtml = '<span class="diagram-node-status status-archived">SELESAI &amp; DIARSIPKAN</span>';
        } else {
          stateClass = 'node-current-active';
          badgeHtml = `<span class="diagram-node-status status-current">LOKASI SAAT INI: ${formatStatusLabel(doc.current_status)}</span>`;
        }
      } else if (node.is_visited) {
        stateClass = 'node-visited';
        badgeHtml = '<span class="diagram-node-status status-visited">✓ Telah Dilalui</span>';
      }

      nodeEl.className = `flow-node trajectory-node ${stateClass}`;
      nodeEl.innerHTML = `
        <span class="flow-step-tag">${node.step_number}. ${node.role_label}</span>
        <strong>${node.section_short_name}</strong>
        <small>${node.section_name}</small>
        ${badgeHtml}
      `;

      nodeEl.addEventListener('click', () => {
        if (typeof diagramState.onOpenDocumentModal === 'function') {
          diagramState.onOpenDocumentModal(doc);
        }
      });

      flowWrapper.appendChild(nodeEl);

      if (idx < nodes.length - 1) {
        const arrowEl = document.createElement('div');
        arrowEl.className = `flow-arrow ${node.is_visited ? 'arrow-visited' : 'arrow-upcoming'} ${
          isReturningDirection ? 'arrow-return-left' : ''
        }`;
        arrowEl.textContent = isReturningDirection ? '⬅' : '➔';
        flowWrapper.appendChild(arrowEl);
      }
    });

    canvas.appendChild(flowWrapper);

    if (caption) {
      const hiddenCount = Math.max(0, 11 - nodes.length);
      caption.innerHTML = `
        <strong>Mode Fokus Aktif (${nodes.length} dari 11 Seksi Ditampilkan):</strong>
        Menampilkan alur untuk dokumen <code>${doc.doc_tracking_id}</code> (<strong>${doc.subject}</strong>).
        ${hiddenCount} seksi lain yang tidak terlibat disembunyikan otomatis. Klik kotak seksi untuk melihat riwayat detail.
      `;
    }
  }

  /**
   * Render All 11 Sections Grid in Read-Only Mode
   */
  function renderAllSectionsGrid() {
    const gridContainer = document.getElementById('allSectionsGridContainer');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';

    (diagramState.allSectionsMap || []).forEach((sec) => {
      const card = document.createElement('div');
      const hasDocs = sec.active_documents_count > 0;
      card.className = `all-sec-diagram-card ${hasDocs ? 'has-active-docs' : 'empty-sec-docs'} ${
        sec.is_user_section ? 'is-my-section' : ''
      }`;

      const countBadgeClass = hasDocs ? 'sec-doc-count-badge active' : 'sec-doc-count-badge';
      const countText = hasDocs ? `${sec.active_documents_count} Dokumen Aktif` : '0 Dokumen';

      let docsListHtml = '';
      if (!hasDocs) {
        docsListHtml = `<div class="all-sec-empty-note">Tidak ada dokumen yang sedang berada di seksi ini.</div>`;
      } else {
        docsListHtml = `<div class="all-sec-docs-list"></div>`;
      }

      card.innerHTML = `
        <div class="all-sec-card-header">
          <div>
            <span class="all-sec-order-tag">Seksi #${sec.sort_order}${sec.is_user_section ? ' • Seksi Anda' : ''}</span>
            <h4>${sec.section_short_name}</h4>
            <p>${sec.section_name}</p>
          </div>
          <span class="${countBadgeClass}">${countText}</span>
        </div>
        ${docsListHtml}
      `;

      if (hasDocs) {
        const listEl = card.querySelector('.all-sec-docs-list');
        (sec.stationed_documents || []).forEach((doc) => {
          const chip = document.createElement('div');
          chip.className = 'all-sec-doc-chip';
          const statusLabel = formatStatusLabel(doc.current_status);
          chip.innerHTML = `
            <div class="all-sec-doc-chip-top">
              <span class="doc-id-mono">${doc.doc_tracking_id}</span>
              <span class="sifat-badge sifat-${doc.classification}">${doc.classification}</span>
            </div>
            <div class="all-sec-doc-chip-subject">${doc.subject}</div>
            <div class="all-sec-doc-chip-meta">
              <span>Asal: ${doc.origin_section_short_name}</span>
              <strong>${statusLabel}</strong>
            </div>
          `;
          chip.addEventListener('click', () => {
            if (typeof diagramState.onOpenDocumentModal === 'function') {
              diagramState.onOpenDocumentModal(doc);
            }
          });
          listEl.appendChild(chip);
        });
      }

      gridContainer.appendChild(card);
    });
  }

  /**
   * Initialize Diagram event listeners
   * @param {{ onOpenDocumentModal: function }} options
   */
  function initDiagram(options = {}) {
    if (options.onOpenDocumentModal) {
      diagramState.onOpenDocumentModal = options.onOpenDocumentModal;
    }

    const toggleBtn = document.getElementById('toggleAllSectionsDiagramBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleDiagramMode);
    }

    const docSelect = document.getElementById('diagramDocumentSelect');
    if (docSelect) {
      docSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          selectFocusedDocument(Number(e.target.value));
        }
      });
    }
  }

  window.DokutraDiagram = {
    initDiagram,
    refreshDiagram,
    toggleDiagramMode,
    selectFocusedDocument
  };
})();

