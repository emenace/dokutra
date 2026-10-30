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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DITERUSKAN', ?, ?)
    `);

    const result = insertDocStmt.run(
      docTrackingId,
      docDate,
      docNumber,
      subject,
      classification,
      description,
      user.section_id,
      user.section_id, // Physical location stays at origin section until recipient marks Diterima/Diproses
      routeInfo.immediateNextSection.id,
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

    // 1. Log creation (DIBUAT)
    const initialNote = description
      ? `Dokumen dibuat: ${description}`
      : `Dokumen baru terdaftar di seksi ${user.section_short_name}.`;

    insertLogStmt.run(
      documentId,
      user.section_id,
      user.section_id,
      'DIBUAT',
      initialNote,
      user.id
    );

    // 2. Log forwarding (DITERUSKAN) to immediate next section
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

  return {
    ...doc,
    planned_route: plannedRoute,
    logs
  };
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
      so.short_name AS origin_section_short_name,
      sc.code AS current_section_code,
      sc.short_name AS current_section_short_name,
      sp.code AS pending_section_code,
      sp.short_name AS pending_section_short_name,
      sf.code AS final_target_section_code,
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

    return {
      ...doc,
      planned_route: plannedRoute,
      logs
    };
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

module.exports = {
  handleGeneratePreviewId,
  handleGetRoutePreview,
  handleCreateDocument,
  handleGetDocuments,
  getHydratedDocumentById
};

