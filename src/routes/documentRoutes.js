const { db } = require('../config/database');
const { SESSION_COOKIE_NAME, parseCookies, getActiveSessionUser } = require('../middleware/auth');
const { generateUniqueDocTrackingId, calculateSmartRoute } = require('../services/routingEngine');

const VALID_CLASSIFICATIONS = ['Biasa', 'Penting', 'Rahasia'];

/**
 * Helper to authenticate incoming request via 6-hour session cookie
 */
function requireAuth(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[SESSION_COOKIE_NAME];
  const sessionData = getActiveSessionUser(sid);
  if (!sessionData) {
    res.sendJson(401, {
      success: false,
      message: 'Sesi Anda telah berakhir. Silakan masuk kembali.'
    });
    return null;
  }
  return sessionData.user;
}

/**
 * Format today's local date as YYYY-MM-DD
 * @param {Date} [now]
 * @returns {string}
 */
function getTodayDateString(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Handle GET /api/documents/generate-id
 * Generates a unique preview Document Tracking ID (DATE+TIME+SectionName) and today's date
 */
function handleGeneratePreviewId(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;

  const now = new Date();
  const docTrackingId = generateUniqueDocTrackingId(user.section_code, now);
  const todayDate = getTodayDateString(now);

  return res.sendJson(200, {
    success: true,
    doc_tracking_id: docTrackingId,
    default_doc_date: todayDate,
    section_code: user.section_code,
    section_short_name: user.section_short_name
  });
}

/**
 * Handle GET /api/documents/route-preview?target_section_id=...
 * Returns the calculated Smart Route chain for previewing in the form
 */
function handleGetRoutePreview(req, res, queryParams) {
  const user = requireAuth(req, res);
  if (!user) return;

  const targetSectionId = queryParams.get('target_section_id');
  if (!targetSectionId) {
    return res.sendJson(400, {
      success: false,
      message: 'Parameter target_section_id diperlukan.'
    });
  }

  try {
    const routeInfo = calculateSmartRoute(user.section_id, targetSectionId);
    return res.sendJson(200, {
      success: true,
      is_auto_bridged: routeInfo.isAutoBridged,
      explanation: routeInfo.routingExplanation,
      immediate_next_section: {
        id: routeInfo.immediateNextSection.id,
        code: routeInfo.immediateNextSection.code,
        name: routeInfo.immediateNextSection.name,
        short_name: routeInfo.immediateNextSection.short_name
      },
      final_target_section: {
        id: routeInfo.finalTargetSection.id,
        code: routeInfo.finalTargetSection.code,
        name: routeInfo.finalTargetSection.name,
        short_name: routeInfo.finalTargetSection.short_name
      },
      planned_route_codes: routeInfo.plannedRouteCodes,
      full_route_chain: routeInfo.fullRouteChain.map((sec) => ({
        id: sec.id,
        code: sec.code,
        name: sec.name,
        short_name: sec.short_name
      }))
    });
  } catch (error) {
    return res.sendJson(400, {
      success: false,
      message: error.message
    });
  }
}

/**
 * Handle POST /api/documents
 * Creates a new tracker document and records its initial DIBUAT & DITERUSKAN logs
 */
function handleCreateDocument(req, res, body) {
  const user = requireAuth(req, res);
  if (!user) return;

  const docDate = String(body.doc_date || '').trim() || getTodayDateString();
  const docNumber = String(body.doc_number || '').trim();
  const subject = String(body.subject || '').trim();
  const classification = String(body.classification || '').trim();
  const description = String(body.description || '').trim();
  const targetSectionId = body.target_section_id;

  // Validate required fields
  if (!docDate) {
    return res.sendJson(400, {
      success: false,
      message: 'Tanggal Dokumen wajib diisi.'
    });
  }

  if (!subject) {
    return res.sendJson(400, {
      success: false,
      message: 'Hal (Perihal Dokumen) wajib diisi.'
    });
  }

  if (!VALID_CLASSIFICATIONS.includes(classification)) {
    return res.sendJson(400, {
      success: false,
      message: 'Sifat dokumen wajib dipilih (Biasa, Penting, atau Rahasia).'
    });
  }

  if (!targetSectionId) {
    return res.sendJson(400, {
      success: false,
      message: 'Tujuan penerusan dokumen (Teruskan Dokumen Ke) wajib dipilih.'
    });
  }

  let routeInfo;
  try {
    routeInfo = calculateSmartRoute(user.section_id, targetSectionId);
  } catch (error) {
    return res.sendJson(400, {
      success: false,
      message: error.message
    });
  }

  // Always server-generate or verify uniqueness of doc_tracking_id (not manually editable by user)
  let docTrackingId = String(body.doc_tracking_id || '').trim();
  const expectedPrefixPattern = new RegExp(`^\\d{8}-\\d{6}-${user.section_code}(-\\d+)?$`);
  const existingCheck = docTrackingId
    ? db.prepare('SELECT COUNT(*) as count FROM documents WHERE doc_tracking_id = ?').get(docTrackingId).count
    : 1;

  if (!docTrackingId || !expectedPrefixPattern.test(docTrackingId) || existingCheck > 0) {
    docTrackingId = generateUniqueDocTrackingId(user.section_code, new Date());
  }

  const plannedRouteJson = JSON.stringify(routeInfo.plannedRouteCodes);

  db.exec('BEGIN TRANSACTION');
  try {
    // Auto-receive rule: when forwarded to a section, the document is automatically received
    // by the immediate target section (current_section_id = immediateNextSection.id, current_status = 'DITERIMA')
    // and flagged in pending_section_id so the receiving section gets a notification to review it.
    const insertDocStmt = db.prepare(`
      INSERT INTO documents (
        doc_tracking_id,
        doc_date,
        doc_number,
        subject,
        classification,
        description,
        origin_section_id,
        current_section_id,
        pending_section_id,
        final_target_section_id,
        current_status,
        planned_route_json,
        created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DITERIMA', ?, ?)
    `);

    const result = insertDocStmt.run(
      docTrackingId,
      docDate,
      docNumber,
      subject,
      classification,
      description,
      user.section_id,
      routeInfo.immediateNextSection.id, // Auto-received at immediate destination section
      routeInfo.immediateNextSection.id, // Flagged for incoming review notification at that section
      routeInfo.finalTargetSection.id,
      plannedRouteJson,
      user.id
    );

    const documentId = Number(result.lastInsertRowid);

    const insertLogStmt = db.prepare(`
      INSERT INTO document_logs (
        document_id,
        from_section_id,
        to_section_id,
        action_status,
        note,
        action_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    // 1. Log creation (DIBUAT - Green)
    const initialNote = description
      ? `Dokumen dibuat: ${description}`
      : `Dokumen baru terdaftar di ${user.section_short_name}.`;

    insertLogStmt.run(
      documentId,
      user.section_id,
      user.section_id,
      'DIBUAT',
      initialNote,
      user.id
    );

    // 2. Log forwarding (DITERUSKAN - Blue) from origin section to immediate next section
    const forwardNote = routeInfo.isAutoBridged
      ? `Diteruskan menuju ${routeInfo.finalTargetSection.short_name} melalui ${routeInfo.immediateNextSection.short_name}.`
      : `Diteruskan ke ${routeInfo.immediateNextSection.short_name}.`;

    insertLogStmt.run(
      documentId,
      user.section_id,
      routeInfo.immediateNextSection.id,
      'DITERUSKAN',
      forwardNote,
      user.id
    );

    // 3. Log automatic Diterima & Menunggu (DITERIMA - Green) at immediate next section
    const autoReceiveNote = `Otomatis Diterima & Menunggu tindak lanjut di ${routeInfo.immediateNextSection.short_name}.`;

    insertLogStmt.run(
      documentId,
      routeInfo.immediateNextSection.id,
      routeInfo.immediateNextSection.id,
      'DITERIMA',
      autoReceiveNote,
      user.id
    );

    db.exec('COMMIT');

    const createdDoc = getHydratedDocumentById(documentId);

    return res.sendJson(201, {
      success: true,
      message: 'Pelacakan dokumen baru berhasil dibuat dan diteruskan.',
      routing_explanation: routeInfo.routingExplanation,
      document: createdDoc
    });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('[Create Document Error]:', error);
    return res.sendJson(500, {
      success: false,
      message: 'Gagal menyimpan pelacakan dokumen baru.'
    });
  }
}

/**
 * Build Focused Diagram Trajectory nodes for a single document.
 * Includes ONLY the sections involved in this document's movement:
 * Origin -> Visited Sections (from logs) -> Current Section -> Remaining Planned Route Sections
 * @param {object} doc
 * @param {Map<string, object>} sectionsByCode
 */
function buildDocumentTrajectory(doc, sectionsByCode) {
  const orderedCodes = [];
  const visitedSet = new Set();

  const addCode = (code) => {
    if (!code) return;
    const upper = String(code).toUpperCase();
    if (!orderedCodes.includes(upper)) {
      orderedCodes.push(upper);
    }
  };

  if (doc.origin_section_code) {
    addCode(doc.origin_section_code);
    visitedSet.add(String(doc.origin_section_code).toUpperCase());
  }

  (doc.logs || []).forEach((log) => {
    if (log.from_section_code) {
      addCode(log.from_section_code);
      visitedSet.add(String(log.from_section_code).toUpperCase());
    }
    if (log.to_section_code) {
      addCode(log.to_section_code);
      visitedSet.add(String(log.to_section_code).toUpperCase());
    }
  });

  if (doc.current_section_code) {
    addCode(doc.current_section_code);
    visitedSet.add(String(doc.current_section_code).toUpperCase());
  }

  (doc.planned_route || []).forEach((code) => {
    addCode(code);
  });

  if (doc.final_target_section_code) {
    addCode(doc.final_target_section_code);
  }

  const currentCode = String(doc.current_section_code || '').toUpperCase();
  const originCode = String(doc.origin_section_code || '').toUpperCase();
  const finalCode = String(doc.final_target_section_code || '').toUpperCase();

  return orderedCodes
    .map((code, idx) => {
      const sec = sectionsByCode.get(code);
      if (!sec) return null;

      const isCurrent = code === currentCode;
      const isVisited = visitedSet.has(code);
      const isOrigin = code === originCode;
      const isFinalTarget = code === finalCode;

      let nodeState = 'upcoming'; // 'completed' | 'current' | 'upcoming'
      if (isCurrent) {
        nodeState = 'current';
      } else if (isVisited) {
        nodeState = 'completed';
      }

      let roleLabel = 'Seksi Transit / Review';
      if (isOrigin && isCurrent && doc.current_status === 'SELESAI') {
        roleLabel = 'Seksi Asal (Selesai & Arsip)';
      } else if (isOrigin && isCurrent && doc.is_returned_signed_to_origin) {
        roleLabel = 'Kembali ke Seksi Asal';
      } else if (isOrigin) {
        roleLabel = 'Seksi Pengirim Awal';
      } else if (code === 'HUMAS') {
        roleLabel = 'Jembatan Protokol';
      } else if (code === 'KASUBBAG') {
        roleLabel = 'Verifikasi / Paraf';
      } else if (code === 'KEPALA') {
        roleLabel = 'Persetujuan / Tandatangan';
      } else if (isFinalTarget) {
        roleLabel = 'Seksi Tujuan';
      }

      return {
        step_number: idx + 1,
        section_id: sec.id,
        section_code: sec.code,
        section_name: sec.name,
        section_short_name: sec.short_name,
        node_state: nodeState,
        is_current: isCurrent,
        is_visited: isVisited,
        is_origin: isOrigin,
        is_final_target: isFinalTarget,
        role_label: roleLabel,
        current_status: isCurrent ? doc.current_status : null
      };
    })
    .filter(Boolean);
}

/**
 * Fetch a single document with hydrated section names and audit logs
 * @param {number} documentId
 */
function getHydratedDocumentById(documentId) {
  const doc = db.prepare(`
    SELECT
      d.*,
      so.code AS origin_section_code,
      so.name AS origin_section_name,
      so.short_name AS origin_section_short_name,
      sc.code AS current_section_code,
      sc.name AS current_section_name,
      sc.short_name AS current_section_short_name,
      sp.code AS pending_section_code,
      sp.name AS pending_section_name,
      sp.short_name AS pending_section_short_name,
      sf.code AS final_target_section_code,
      sf.name AS final_target_section_name,
      sf.short_name AS final_target_section_short_name,
      u.full_name AS created_by_name
    FROM documents d
    JOIN sections so ON d.origin_section_id = so.id
    JOIN sections sc ON d.current_section_id = sc.id
    LEFT JOIN sections sp ON d.pending_section_id = sp.id
    LEFT JOIN sections sf ON d.final_target_section_id = sf.id
    JOIN users u ON d.created_by_user_id = u.id
    WHERE d.id = ?
  `).get(documentId);

  if (!doc) return null;

  const logs = db.prepare(`
    SELECT
      l.*,
      sf.code AS from_section_code,
      sf.short_name AS from_section_short_name,
      st.code AS to_section_code,
      st.short_name AS to_section_short_name,
      u.full_name AS action_by_name
    FROM document_logs l
    JOIN sections sf ON l.from_section_id = sf.id
    JOIN sections st ON l.to_section_id = st.id
    JOIN users u ON l.action_by_user_id = u.id
    WHERE l.document_id = ?
    ORDER BY l.id ASC
  `).all(documentId);

  let plannedRoute = [];
  try {
    plannedRoute = JSON.parse(doc.planned_route_json || '[]');
  } catch {
    plannedRoute = [];
  }

  // Determine if document is currently at HUMAS after being returned from KASUBBAG or KEPALA
  const forwardLogs = logs.filter((l) => l.action_status === 'DITERUSKAN');
  const lastForwardLog = forwardLogs.length > 0 ? forwardLogs[forwardLogs.length - 1] : null;
  const isReturnFromPimpinan =
    doc.current_section_code === 'HUMAS' &&
    lastForwardLog !== null &&
    (lastForwardLog.from_section_code === 'KASUBBAG' || lastForwardLog.from_section_code === 'KEPALA');

  // Determine if document was returned from HUMAS back to origin section after being signed by KASUBBAG or KEPALA
  const hasBeenSignedByPimpinanToHumas = forwardLogs.some(
    (l) => (l.from_section_code === 'KASUBBAG' || l.from_section_code === 'KEPALA') && l.to_section_code === 'HUMAS'
  );
  const isReturnedSignedToOrigin =
    doc.current_section_id === doc.origin_section_id &&
    doc.current_status !== 'SELESAI' &&
    lastForwardLog !== null &&
    lastForwardLog.from_section_code === 'HUMAS' &&
    lastForwardLog.to_section_id === doc.origin_section_id &&
    hasBeenSignedByPimpinanToHumas;

  const allSections = db.prepare('SELECT * FROM sections ORDER BY sort_order ASC').all();
  const sectionsByCode = new Map(allSections.map((s) => [s.code.toUpperCase(), s]));

  const hydratedDoc = {
    ...doc,
    planned_route: plannedRoute,
    is_return_from_pimpinan: isReturnFromPimpinan,
    is_returned_signed_to_origin: isReturnedSignedToOrigin,
    is_returning_direction: hasBeenSignedByPimpinanToHumas,
    is_archived: doc.current_status === 'SELESAI',
    last_forward_from_code: lastForwardLog ? lastForwardLog.from_section_code : null,
    logs
  };

  hydratedDoc.trajectory_nodes = buildDocumentTrajectory(hydratedDoc, sectionsByCode);
  return hydratedDoc;
}

/**
 * Handle GET /api/documents
 * Returns documents relevant to the logged-in section (or all documents if view=all)
 */
function handleGetDocuments(req, res, queryParams) {
  const user = requireAuth(req, res);
  if (!user) return;

  const viewMode = queryParams.get('view') || 'section';

  const allDocs = db.prepare(`
    SELECT
      d.*,
      so.code AS origin_section_code,
      so.name AS origin_section_name,
      so.short_name AS origin_section_short_name,
      sc.code AS current_section_code,
      sc.name AS current_section_name,
      sc.short_name AS current_section_short_name,
      sp.code AS pending_section_code,
      sp.name AS pending_section_name,
      sp.short_name AS pending_section_short_name,
      sf.code AS final_target_section_code,
      sf.name AS final_target_section_name,
      sf.short_name AS final_target_section_short_name,
      u.full_name AS created_by_name
    FROM documents d
    JOIN sections so ON d.origin_section_id = so.id
    JOIN sections sc ON d.current_section_id = sc.id
    LEFT JOIN sections sp ON d.pending_section_id = sp.id
    LEFT JOIN sections sf ON d.final_target_section_id = sf.id
    JOIN users u ON d.created_by_user_id = u.id
    ORDER BY d.id DESC
  `).all();

  const allSections = db.prepare('SELECT * FROM sections ORDER BY sort_order ASC').all();
  const sectionsByCode = new Map(allSections.map((s) => [s.code.toUpperCase(), s]));

  const hydratedDocs = allDocs.map((doc) => {
    const logs = db.prepare(`
      SELECT
        l.*,
        sf.code AS from_section_code,
        sf.short_name AS from_section_short_name,
        st.code AS to_section_code,
        st.short_name AS to_section_short_name,
        u.full_name AS action_by_name
      FROM document_logs l
      JOIN sections sf ON l.from_section_id = sf.id
      JOIN sections st ON l.to_section_id = st.id
      JOIN users u ON l.action_by_user_id = u.id
      WHERE l.document_id = ?
      ORDER BY l.id ASC
    `).all(doc.id);

    let plannedRoute = [];
    try {
      plannedRoute = JSON.parse(doc.planned_route_json || '[]');
    } catch {
      plannedRoute = [];
    }

    const forwardLogs = logs.filter((l) => l.action_status === 'DITERUSKAN');
    const lastForwardLog = forwardLogs.length > 0 ? forwardLogs[forwardLogs.length - 1] : null;
    const isReturnFromPimpinan =
      doc.current_section_code === 'HUMAS' &&
      lastForwardLog !== null &&
      (lastForwardLog.from_section_code === 'KASUBBAG' || lastForwardLog.from_section_code === 'KEPALA');

    const hasBeenSignedByPimpinanToHumas = forwardLogs.some(
      (l) => (l.from_section_code === 'KASUBBAG' || l.from_section_code === 'KEPALA') && l.to_section_code === 'HUMAS'
    );
    const isReturnedSignedToOrigin =
      doc.current_section_id === doc.origin_section_id &&
      doc.current_status !== 'SELESAI' &&
      lastForwardLog !== null &&
      lastForwardLog.from_section_code === 'HUMAS' &&
      lastForwardLog.to_section_id === doc.origin_section_id &&
      hasBeenSignedByPimpinanToHumas;

    const hydratedDoc = {
      ...doc,
      planned_route: plannedRoute,
      is_return_from_pimpinan: isReturnFromPimpinan,
      is_returned_signed_to_origin: isReturnedSignedToOrigin,
      is_archived: doc.current_status === 'SELESAI',
      last_forward_from_code: lastForwardLog ? lastForwardLog.from_section_code : null,
      logs
    };

    hydratedDoc.trajectory_nodes = buildDocumentTrajectory(hydratedDoc, sectionsByCode);
    return hydratedDoc;
  });

  if (viewMode === 'all') {
    return res.sendJson(200, {
      success: true,
      documents: hydratedDocs
    });
  }

  // Filter documents where user's section is involved (origin, current, pending, final target, or in logs)
  const sectionDocs = hydratedDocs.filter((doc) => {
    if (
      doc.origin_section_id === user.section_id ||
      doc.current_section_id === user.section_id ||
      doc.pending_section_id === user.section_id ||
      doc.final_target_section_id === user.section_id
    ) {
      return true;
    }
    return doc.logs.some(
      (l) => l.from_section_id === user.section_id || l.to_section_id === user.section_id
    );
  });

  return res.sendJson(200, {
    success: true,
    documents: sectionDocs
  });
}

/**
 * Handle GET /api/documents/inbox
 * Returns incoming documents awaiting action or currently stationed at the logged-in user's section
 */
function handleGetInboxDocuments(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;

  // Fetch documents where:
  // 1) pending_section_id === user.section_id (Incoming from another section, awaiting review)
  // 2) OR current_section_id === user.section_id AND pending_section_id IS NULL AND current_status != 'SELESAI'
  const rows = db.prepare(`
    SELECT id FROM documents
    WHERE pending_section_id = ?
       OR (current_section_id = ? AND pending_section_id IS NULL AND current_status != 'SELESAI')
    ORDER BY updated_at DESC, id DESC
  `).all(user.section_id, user.section_id);

  const hydrated = rows.map((r) => getHydratedDocumentById(r.id)).filter(Boolean);

  // Separate strictly newly incoming (pending_section_id === user.section_id) vs already held at section
  const incomingPending = hydrated.filter((d) => d.pending_section_id === user.section_id);
  const heldAtSection = hydrated.filter(
    (d) => d.current_section_id === user.section_id && d.pending_section_id === null
  );

  return res.sendJson(200, {
    success: true,
    incoming_count: incomingPending.length,
    incoming_documents: incomingPending,
    active_section_documents: heldAtSection,
    all_actionable_documents: hydrated
  });
}

/**
 * Handle POST /api/documents/:id/review
 * Document received in section is automatically Diterima & Menunggu (`current_status = 'DITERIMA'`).
 * Review action selections:
 * - Standard sections: [Tolak (DITOLAK), Teruskan (TERUSKAN)]
 * - KASUBBAG: [Tolak (DITOLAK), Teruskan (TERUSKAN), Paraf / Tandatangan dan Teruskan ke Protokol (TERUSKAN_PROTOKOL)]
 * - KEPALA: [Tolak (DITOLAK), Tandatangan dan Teruskan ke Protokol (TERUSKAN_PROTOKOL)]
 * - HUMAS (when received from KASUBBAG or KEPALA): [Tolak (DITOLAK), Teruskan ke Seksi (TERUSKAN_SEKSI)]
 */
function handleReviewDocument(req, res, documentId, body) {
  const user = requireAuth(req, res);
  if (!user) return;

  const doc = getHydratedDocumentById(Number(documentId));
  if (!doc) {
    return res.sendJson(404, {
      success: false,
      message: 'Dokumen tidak ditemukan.'
    });
  }

  // Verify authorization: user's section must be either the pending recipient or current holder
  const isPendingRecipient = doc.pending_section_id === user.section_id;
  const isCurrentHolder = doc.current_section_id === user.section_id;

  if (!isPendingRecipient && !isCurrentHolder) {
    return res.sendJson(403, {
      success: false,
      message: 'Seksi Anda tidak memiliki akses tindak lanjut untuk posisi dokumen saat ini.'
    });
  }

  let rawAction = String(body.action_status || '').trim().toUpperCase();
  if (rawAction === 'TOLAK') {
    rawAction = 'DITOLAK';
  } else if (rawAction === 'TERUSKAN') {
    rawAction = 'DITERUSKAN';
  }

  const note = String(body.note || '').trim();
  const targetSectionId = body.target_section_id;

  if (!['DITOLAK', 'DITERUSKAN', 'TERUSKAN_PROTOKOL', 'TERUSKAN_SEKSI', 'SELESAI'].includes(rawAction)) {
    return res.sendJson(400, {
      success: false,
      message: 'Pilihan tindak lanjut tidak valid. Pilih Tolak, Teruskan, atau Selesai.'
    });
  }

  const insertLogStmt = db.prepare(`
    INSERT INTO document_logs (
      document_id,
      from_section_id,
      to_section_id,
      action_status,
      note,
      action_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION');
  try {
    if (rawAction === 'SELESAI') {
      const defaultNote = `Dokumen selesai dan disimpan ke Arsip oleh ${user.section_short_name}.`;

      db.prepare(`
        UPDATE documents
        SET current_section_id = ?,
            pending_section_id = NULL,
            current_status = 'SELESAI',
            planned_route_json = '[]',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(user.section_id, doc.id);

      insertLogStmt.run(
        doc.id,
        user.section_id,
        user.section_id,
        'SELESAI',
        note || defaultNote,
        user.id
      );

      db.exec('COMMIT');

      const updatedDoc = getHydratedDocumentById(doc.id);
      return res.sendJson(200, {
        success: true,
        message: `Dokumen ${doc.doc_tracking_id} telah ditandai Selesai dan dipindahkan ke Arsip.`,
        document: updatedDoc
      });
    }

    if (rawAction === 'DITOLAK') {
      const defaultNote = `Dokumen ditolak di ${user.section_short_name}.`;

      db.prepare(`
        UPDATE documents
        SET current_section_id = ?,
            pending_section_id = NULL,
            current_status = 'DITOLAK',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(user.section_id, doc.id);

      insertLogStmt.run(
        doc.id,
        user.section_id,
        user.section_id,
        'DITOLAK',
        note || defaultNote,
        user.id
      );

      db.exec('COMMIT');

      const updatedDoc = getHydratedDocumentById(doc.id);
      return res.sendJson(200, {
        success: true,
        message: `Status dokumen berhasil diperbarui menjadi Ditolak di ${user.section_short_name}.`,
        document: updatedDoc
      });
    }

    const allSections = db.prepare('SELECT * FROM sections').all();
    const byCode = new Map(allSections.map((s) => [s.code.toUpperCase(), s]));
    const byId = new Map(allSections.map((s) => [s.id, s]));
    const humasSection = byCode.get('HUMAS');
    const originSection = byId.get(doc.origin_section_id);

    let plannedRouteCodes = Array.isArray(doc.planned_route) ? [...doc.planned_route] : [];
    let nextImmediateSection = null;
    let finalTargetSectionId = doc.final_target_section_id;
    let routingMessage = '';
    let forwardLogNote = '';

    // Case 1: Kasubbag or Kepala selects "Paraf / Tandatangan dan Teruskan ke Protokol" or "Tandatangan dan Teruskan ke Protokol"
    if (
      rawAction === 'TERUSKAN_PROTOKOL' ||
      ((user.section_code === 'KASUBBAG' || user.section_code === 'KEPALA') &&
        humasSection &&
        Number(targetSectionId) === humasSection.id)
    ) {
      if (user.section_code !== 'KASUBBAG' && user.section_code !== 'KEPALA') {
        throw new Error('Opsi Teruskan ke Protokol hanya tersedia untuk Kasubbag TU dan Kepala Kantor.');
      }
      nextImmediateSection = humasSection;
      finalTargetSectionId = doc.origin_section_id;
      plannedRouteCodes = originSection ? [originSection.code] : [];

      const actionLabel =
        user.section_code === 'KASUBBAG'
          ? 'Paraf / Tandatangan dan Teruskan ke Protokol'
          : 'Tandatangan dan Teruskan ke Protokol';

      forwardLogNote = note
        ? `${note} (${actionLabel})`
        : `${actionLabel} — diteruskan ke ${humasSection.short_name}.`;

      routingMessage = `Dokumen telah di-${user.section_code === 'KASUBBAG' ? 'paraf/tandatangan' : 'tandatangan'} dan otomatis diteruskan ke ${humasSection.short_name}.`;
    }
    // Case 2: Humas Protokol received document from Kasubbag or Kepala and selects "Teruskan ke Seksi" (auto-selects source section)
    else if (
      rawAction === 'TERUSKAN_SEKSI' ||
      (user.section_code === 'HUMAS' && doc.is_return_from_pimpinan)
    ) {
      if (!originSection) {
        throw new Error('Seksi asal dokumen tidak ditemukan.');
      }
      nextImmediateSection = originSection;
      finalTargetSectionId = originSection.id;
      plannedRouteCodes = [];

      forwardLogNote = note
        ? `${note} (Teruskan ke Seksi ${originSection.short_name})`
        : `Teruskan ke Seksi: Dokumen dikembalikan dari Humas Protokol ke seksi asal (${originSection.short_name}).`;

      routingMessage = `Dokumen berhasil diteruskan kembali ke seksi asal: ${originSection.short_name}.`;
    }
    // Case 3: Standard "Teruskan" (with planned route or target dropdown)
    else {
      if (plannedRouteCodes.length > 0 && (!targetSectionId || Number(targetSectionId) === doc.final_target_section_id)) {
        const nextCode = plannedRouteCodes.shift();
        nextImmediateSection = byCode.get(String(nextCode).toUpperCase());
        if (!nextImmediateSection) {
          throw new Error('Rute lanjutan otomatis tidak valid.');
        }
        routingMessage = `Dokumen diteruskan dan otomatis Diterima & Menunggu di tahap berikutnya: ${nextImmediateSection.short_name}.`;
      } else {
        if (!targetSectionId) {
          db.exec('ROLLBACK');
          return res.sendJson(400, {
            success: false,
            message: 'Silakan pilih seksi tujuan pada dropdown "Teruskan Dokumen Ke".'
          });
        }
        const routeInfo = calculateSmartRoute(user.section_id, targetSectionId);
        nextImmediateSection = routeInfo.immediateNextSection;
        finalTargetSectionId = routeInfo.finalTargetSection.id;
        plannedRouteCodes = routeInfo.plannedRouteCodes;
        routingMessage = routeInfo.routingExplanation;
      }

      forwardLogNote = note
        ? `${note} (Diteruskan ke ${nextImmediateSection.short_name})`
        : `Diteruskan ke ${nextImmediateSection.short_name}.`;
    }

    // Auto-receive & Menunggu rule on forward:
    // The document immediately arrives and is auto-received & waiting at nextImmediateSection.id (current_status = 'DITERIMA'),
    // while pending_section_id = nextImmediateSection.id triggers the Big Incoming Notification for that section's PIC.
    db.prepare(`
      UPDATE documents
      SET current_section_id = ?,
          pending_section_id = ?,
          final_target_section_id = ?,
          current_status = 'DITERIMA',
          planned_route_json = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      nextImmediateSection.id,
      nextImmediateSection.id,
      finalTargetSectionId,
      JSON.stringify(plannedRouteCodes),
      doc.id
    );

    // 1. Log forwarding action (DITERUSKAN - Blue)
    insertLogStmt.run(
      doc.id,
      user.section_id,
      nextImmediateSection.id,
      'DITERUSKAN',
      forwardLogNote,
      user.id
    );

    // 2. Log automatic Diterima & Menunggu at destination section (DITERIMA - Green)
    insertLogStmt.run(
      doc.id,
      nextImmediateSection.id,
      nextImmediateSection.id,
      'DITERIMA',
      `Otomatis Diterima & Menunggu tindak lanjut di ${nextImmediateSection.short_name}.`,
      user.id
    );

    db.exec('COMMIT');

    const updatedDoc = getHydratedDocumentById(doc.id);
    return res.sendJson(200, {
      success: true,
      message: `Dokumen berhasil diteruskan. ${routingMessage}`,
      document: updatedDoc
    });
  } catch (error) {
    db.exec('ROLLBACK');
    return res.sendJson(400, {
      success: false,
      message: error.message || 'Gagal memproses tindak lanjut dokumen.'
    });
  }
}

/**
 * Handle GET /api/documents/diagram
 * Returns:
 * - focused_document: The requested document (by ?document_id=) or most recent active document for the user's section,
 *   including its `trajectory_nodes` (ONLY sections participating in its path).
 * - all_sections_map: All 11 office sections with the active documents currently stationed at each section (Read-Only mode).
 */
function handleGetDiagramData(req, res, queryParams) {
  const user = requireAuth(req, res);
  if (!user) return;

  const rawDocId =
    queryParams && typeof queryParams.get === 'function' ? queryParams.get('document_id') : null;
  const requestedDocId = rawDocId ? Number(rawDocId) : null;
  const allSections = db.prepare('SELECT * FROM sections ORDER BY sort_order ASC').all();

  const allDocIds = db.prepare('SELECT id FROM documents ORDER BY updated_at DESC, id DESC').all();
  const allHydratedDocs = allDocIds.map((r) => getHydratedDocumentById(r.id)).filter(Boolean);

  // Documents involving the current user's section
  const sectionDocs = allHydratedDocs.filter((doc) => {
    if (
      doc.origin_section_id === user.section_id ||
      doc.current_section_id === user.section_id ||
      doc.pending_section_id === user.section_id ||
      doc.final_target_section_id === user.section_id
    ) {
      return true;
    }
    return doc.logs.some(
      (l) => l.from_section_id === user.section_id || l.to_section_id === user.section_id
    );
  });

  let focusedDocument = null;
  if (requestedDocId) {
    focusedDocument = allHydratedDocs.find((d) => d.id === requestedDocId) || null;
  }
  if (!focusedDocument && sectionDocs.length > 0) {
    // Prefer an active (non-archived) document first
    focusedDocument = sectionDocs.find((d) => d.current_status !== 'SELESAI') || sectionDocs[0];
  }

  // Build All-Sections Read-Only Map (11 sections with active documents stationed at each section)
  const activeOfficeDocs = allHydratedDocs.filter((d) => d.current_status !== 'SELESAI');
  const allSectionsMap = allSections.map((sec) => {
    const stationedDocs = activeOfficeDocs.filter((d) => d.current_section_id === sec.id);
    return {
      section_id: sec.id,
      section_code: sec.code,
      section_name: sec.name,
      section_short_name: sec.short_name,
      sort_order: sec.sort_order,
      is_user_section: sec.id === user.section_id,
      active_documents_count: stationedDocs.length,
      stationed_documents: stationedDocs
    };
  });

  return res.sendJson(200, {
    success: true,
    focused_document: focusedDocument,
    section_documents: sectionDocs,
    all_sections_map: allSectionsMap
  });
}

module.exports = {
  handleGeneratePreviewId,
  handleGetRoutePreview,
  handleCreateDocument,
  handleGetDocuments,
  handleGetInboxDocuments,
  handleReviewDocument,
  handleGetDiagramData,
  getHydratedDocumentById
};

