const assert = require('node:assert');
const { db, initializeDatabase } = require('../src/config/database');
const { handleLogin } = require('../src/routes/authRoutes');
const {
  handleGeneratePreviewId,
  handleGetRoutePreview,
  handleCreateDocument,
  handleGetDocuments
} = require('../src/routes/documentRoutes');

function invokeHandler(handler, { method = 'GET', url = '/', headers = {}, body = {}, queryParams = new URLSearchParams() } = {}) {
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

  if (method === 'GET' && handler.length >= 3) {
    handler(req, res, queryParams);
  } else {
    handler(req, res, body);
  }

  return { statusCode, headers: responseHeaders, body: jsonPayload };
}

async function runPart3Verification() {
  console.log('=== Starting Part 3 Verification Suite ===');

  initializeDatabase();

  // Clean up any existing test documents so test is idempotent
  db.exec('DELETE FROM document_logs; DELETE FROM documents;');

  // 1. Login as PAPKI PIC
  const loginRes = invokeHandler(handleLogin, {
    method: 'POST',
    body: { username: 'papki', password: '123456' }
  });
  assert.strictEqual(loginRes.statusCode, 200);
  const cookiePair = loginRes.headers['set-cookie'].split(';')[0];

  // 2. Test Auto-Generated Document ID endpoint (/api/documents/generate-id)
  const genIdRes = invokeHandler(handleGeneratePreviewId, {
    headers: { cookie: cookiePair }
  });
  assert.strictEqual(genIdRes.statusCode, 200);
  assert.ok(
    /^\d{8}-\d{6}-PAPKI$/.test(genIdRes.body.doc_tracking_id),
    `Expected format YYYYMMDD-HHMMSS-PAPKI, got ${genIdRes.body.doc_tracking_id}`
  );
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(genIdRes.body.default_doc_date));
  console.log(`[PASS] Auto-generated Document Tracking ID verified: ${genIdRes.body.doc_tracking_id}`);

  // Fetch section IDs for testing Smart Routing
  const kepegawaianSec = db.prepare("SELECT id FROM sections WHERE code = 'KEPEGAWAIAN'").get();
  const kasubbagSec = db.prepare("SELECT id FROM sections WHERE code = 'KASUBBAG'").get();
  const kepalaSec = db.prepare("SELECT id FROM sections WHERE code = 'KEPALA'").get();
  const humasSec = db.prepare("SELECT id FROM sections WHERE code = 'HUMAS'").get();

  // 3. Test Smart Routing Preview: PAPKI -> KEPEGAWAIAN (Direct)
  const previewDirect = invokeHandler(handleGetRoutePreview, {
    headers: { cookie: cookiePair },
    queryParams: new URLSearchParams({ target_section_id: String(kepegawaianSec.id) })
  });
  assert.strictEqual(previewDirect.statusCode, 200);
  assert.strictEqual(previewDirect.body.is_auto_bridged, false);
  assert.strictEqual(previewDirect.body.immediate_next_section.code, 'KEPEGAWAIAN');
  assert.deepStrictEqual(previewDirect.body.planned_route_codes, []);
  console.log('[PASS] Smart Routing Case A (Regular section PAPKI -> KEPEGAWAIAN direct) verified.');

  // 4. Test Smart Routing Preview: PAPKI -> KASUBBAG (Must bridge via HUMAS)
  const previewKasubbag = invokeHandler(handleGetRoutePreview, {
    headers: { cookie: cookiePair },
    queryParams: new URLSearchParams({ target_section_id: String(kasubbagSec.id) })
  });
  assert.strictEqual(previewKasubbag.statusCode, 200);
  assert.strictEqual(previewKasubbag.body.is_auto_bridged, true);
  assert.strictEqual(previewKasubbag.body.immediate_next_section.code, 'HUMAS');
  assert.deepStrictEqual(previewKasubbag.body.planned_route_codes, ['KASUBBAG']);
  console.log('[PASS] Smart Routing Case B (PAPKI -> KASUBBAG auto-bridges via HUMAS) verified.');

  // 5. Test Smart Routing Preview: PAPKI -> KEPALA (Must bridge via HUMAS and be reviewed by KASUBBAG first)
  const previewKepala = invokeHandler(handleGetRoutePreview, {
    headers: { cookie: cookiePair },
    queryParams: new URLSearchParams({ target_section_id: String(kepalaSec.id) })
  });
  assert.strictEqual(previewKepala.statusCode, 200);
  assert.strictEqual(previewKepala.body.is_auto_bridged, true);
  assert.strictEqual(previewKepala.body.immediate_next_section.code, 'HUMAS');
  assert.deepStrictEqual(previewKepala.body.planned_route_codes, ['KASUBBAG', 'KEPALA']);
  console.log('[PASS] Smart Routing Case C (PAPKI -> KEPALA auto-routes via HUMAS -> KASUBBAG -> KEPALA) verified.');

  // 6. Test Rejection if HUMAS is passed manually as target_section_id
  const previewInvalidHumas = invokeHandler(handleGetRoutePreview, {
    headers: { cookie: cookiePair },
    queryParams: new URLSearchParams({ target_section_id: String(humasSec.id) })
  });
  assert.strictEqual(previewInvalidHumas.statusCode, 400, 'Selecting HUMAS manually must be rejected');
  console.log('[PASS] Manual selection of HUMAS is strictly rejected.');

  // 7. Test Creating a Document from PAPKI targeted to KEPALA KANTOR
  const createRes = invokeHandler(handleCreateDocument, {
    method: 'POST',
    headers: { cookie: cookiePair },
    body: {
      doc_date: genIdRes.body.default_doc_date,
      doc_number: 'B-001/Kk.08.07/PP.00/10/2026',
      subject: 'Pengajuan SK Insentif Guru Pondok Pesantren',
      classification: 'Penting',
      description: 'Mohon paraf dan tanda tangan Kepala Kantor',
      doc_tracking_id: genIdRes.body.doc_tracking_id,
      target_section_id: kepalaSec.id
    }
  });
  assert.strictEqual(createRes.statusCode, 201, 'Document creation should return 201 Created');
  const createdDoc = createRes.body.document;
  assert.strictEqual(createdDoc.origin_section_code, 'PAPKI');
  assert.strictEqual(createdDoc.current_section_code, 'HUMAS', 'Auto-received at immediate destination HUMAS');
  assert.strictEqual(createdDoc.current_status, 'DITERIMA', 'Auto-received status must be DITERIMA');
  assert.strictEqual(createdDoc.pending_section_code, 'HUMAS', 'Immediate pending recipient for review must be HUMAS');
  assert.strictEqual(createdDoc.final_target_section_code, 'KEPALA', 'Final target must be KEPALA');
  assert.deepStrictEqual(createdDoc.planned_route, ['KASUBBAG', 'KEPALA']);
  assert.strictEqual(createdDoc.logs.length, 3, 'Should record DIBUAT, DITERUSKAN, and auto-receive DITERIMA & MENUNGGU logs');
  console.log('[PASS] Document creation, Auto-Receive & SQLite audit trail (DIBUAT + DITERUSKAN + DITERIMA & MENUNGGU) verified.');

  // 8. Test Fetching Documents list via GET /api/documents
  const listRes = invokeHandler(handleGetDocuments, {
    headers: { cookie: cookiePair },
    queryParams: new URLSearchParams()
  });
  assert.strictEqual(listRes.statusCode, 200);
  assert.strictEqual(listRes.body.documents.length, 1);
  console.log('[PASS] GET /api/documents verified.');

  // Clean up test document after verification so user starts with a clean database or can create their own
  db.exec('DELETE FROM document_logs; DELETE FROM documents;');

  console.log('=== All Part 3 Checks Passed Successfully! ===');
}

runPart3Verification().catch((err) => {
  console.error('[FAIL] Part 3 Verification Failed:', err);
  process.exit(1);
});

