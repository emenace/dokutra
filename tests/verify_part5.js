const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { db, initializeDatabase } = require('../src/config/database');
const { handleLogin } = require('../src/routes/authRoutes');
const {
  handleCreateDocument,
  handleReviewDocument,
  handleGetDiagramData
} = require('../src/routes/documentRoutes');

function invokeHandler(
  handler,
  { method = 'GET', url = '/', headers = {}, body = {}, paramId = null, queryParams = new URLSearchParams() } = {}
) {
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

  if (paramId !== null) {
    handler(req, res, paramId, body);
  } else if (method === 'GET' && handler.length >= 3) {
    handler(req, res, queryParams);
  } else {
    handler(req, res, body);
  }

  return { statusCode, headers: responseHeaders, body: jsonPayload };
}

function loginAs(username) {
  const res = invokeHandler(handleLogin, {
    method: 'POST',
    body: { username, password: '123456' }
  });
  assert.strictEqual(res.statusCode, 200);
  return res.headers['set-cookie'].split(';')[0];
}

async function runPart5Verification() {
  console.log('=== Starting Part 5 Verification Suite (Interactive Diagram Visualizer) ===');

  initializeDatabase();
  db.exec('DELETE FROM document_logs; DELETE FROM documents;');

  // 1. Verify frontend diagram files and containers exist
  const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf-8');
  const diagramJs = fs.readFileSync(path.join(__dirname, '../public/js/diagram.js'), 'utf-8');
  assert.ok(indexHtml.includes('focusedDiagramViewContainer'), 'Focused diagram container must exist in index.html');
  assert.ok(indexHtml.includes('allSectionsDiagramViewContainer'), 'All-sections diagram container must exist in index.html');
  assert.ok(indexHtml.includes('/js/diagram.js'), 'diagram.js script must be loaded in index.html');
  assert.ok(diagramJs.includes('window.DokutraDiagram'), 'DokutraDiagram controller must be defined in diagram.js');
  console.log('[PASS] Step 1: Diagram Visualizer HTML & JS assets verified.');

  const papkiCookie = loginAs('papki');
  const kepegawaianCookie = loginAs('kepegawaian');
  const humasCookie = loginAs('humas');
  const kasubbagCookie = loginAs('kasubbag');

  const kepegawaianSec = db.prepare("SELECT id FROM sections WHERE code = 'KEPEGAWAIAN'").get();
  const kepalaSec = db.prepare("SELECT id FROM sections WHERE code = 'KEPALA'").get();

  // 2. PAPKI creates a document forwarded to KEPEGAWAIAN
  const createRes = invokeHandler(handleCreateDocument, {
    method: 'POST',
    headers: { cookie: papkiCookie },
    body: {
      doc_date: '2026-10-30',
      doc_number: 'B-500/Kk.08.07/PP.00/10/2026',
      subject: 'Usulan Pencairan BOS Pondok Pesantren',
      classification: 'Penting',
      description: 'Verifikasi Kepegawaian lalu ke Kepala Kantor',
      target_section_id: kepegawaianSec.id
    }
  });
  assert.strictEqual(createRes.statusCode, 201);
  const docId = createRes.body.document.id;

  // Check Focused Diagram when document only involves PAPKI -> KEPEGAWAIAN
  const diagStep1 = invokeHandler(handleGetDiagramData, {
    headers: { cookie: papkiCookie },
    queryParams: new URLSearchParams({ document_id: String(docId) })
  });
  assert.strictEqual(diagStep1.statusCode, 200);
  const nodes1 = diagStep1.body.focused_document.trajectory_nodes;
  assert.deepStrictEqual(
    nodes1.map((n) => n.section_code),
    ['PAPKI', 'KEPEGAWAIAN'],
    'Focused diagram must ONLY include PAPKI and KEPEGAWAIAN (2 sections)'
  );
  assert.strictEqual(nodes1.find((n) => n.is_current).section_code, 'KEPEGAWAIAN');
  console.log('[PASS] Step 2: Focused Diagram shows ONLY involved sections (PAPKI -> KEPEGAWAIAN).');

  // 3. KEPEGAWAIAN forwards to KEPALA (Smart route: KEPEGAWAIAN -> HUMAS -> KASUBBAG -> KEPALA)
  invokeHandler(handleReviewDocument, {
    method: 'POST',
    headers: { cookie: kepegawaianCookie },
    paramId: docId,
    body: {
      action_status: 'TERUSKAN',
      note: 'Telah diverifikasi Kepegawaian, diteruskan ke Kepala Kantor',
      target_section_id: kepalaSec.id
    }
  });

  const diagStep2 = invokeHandler(handleGetDiagramData, {
    headers: { cookie: papkiCookie },
    queryParams: new URLSearchParams({ document_id: String(docId) })
  });
  const nodes2 = diagStep2.body.focused_document.trajectory_nodes;
  assert.deepStrictEqual(
    nodes2.map((n) => n.section_code),
    ['PAPKI', 'KEPEGAWAIAN', 'HUMAS', 'KASUBBAG', 'KEPALA'],
    'Focused diagram must show exactly the 5 involved sections and hide the 6 uninvolved sections'
  );
  assert.strictEqual(nodes2.find((n) => n.is_current).section_code, 'HUMAS');
  assert.strictEqual(nodes2.find((n) => n.section_code === 'KASUBBAG').node_state, 'upcoming');
  assert.strictEqual(nodes2.find((n) => n.section_code === 'KEPALA').node_state, 'upcoming');
  console.log('[PASS] Step 3: Focused Diagram dynamically expands to 5 involved sections (PAPKI -> KEPEGAWAIAN -> HUMAS -> KASUBBAG -> KEPALA).');

  // 4. Verify All-Sections Map (11 sections) shows document stationed at HUMAS
  const allSecMap = diagStep2.body.all_sections_map;
  assert.strictEqual(allSecMap.length, 11, 'All-Sections mode must return all 11 office sections');
  const humasMapEntry = allSecMap.find((s) => s.section_code === 'HUMAS');
  assert.strictEqual(humasMapEntry.active_documents_count, 1);
  assert.strictEqual(humasMapEntry.stationed_documents[0].id, docId);
  const ptspMapEntry = allSecMap.find((s) => s.section_code === 'PTSP');
  assert.strictEqual(ptspMapEntry.active_documents_count, 0);
  console.log('[PASS] Step 4: All-Sections Read-Only Map verified across all 11 office sections.');

  // 5. Complete lifecycle: HUMAS -> KASUBBAG -> (Paraf/Tandatangan ke Protokol) -> HUMAS -> (Teruskan ke Seksi) -> PAPKI -> (Selesai & Arsip)
  invokeHandler(handleReviewDocument, {
    method: 'POST',
    headers: { cookie: humasCookie },
    paramId: docId,
    body: { action_status: 'TERUSKAN', target_section_id: kepalaSec.id }
  });
  invokeHandler(handleReviewDocument, {
    method: 'POST',
    headers: { cookie: kasubbagCookie },
    paramId: docId,
    body: { action_status: 'TERUSKAN_PROTOKOL', note: 'Diparaf & ditandatangani' }
  });
  invokeHandler(handleReviewDocument, {
    method: 'POST',
    headers: { cookie: humasCookie },
    paramId: docId,
    body: { action_status: 'TERUSKAN_SEKSI' }
  });
  invokeHandler(handleReviewDocument, {
    method: 'POST',
    headers: { cookie: papkiCookie },
    paramId: docId,
    body: { action_status: 'SELESAI', note: 'Selesai dan masuk arsip' }
  });

  const diagFinal = invokeHandler(handleGetDiagramData, {
    headers: { cookie: papkiCookie },
    queryParams: new URLSearchParams({ document_id: String(docId) })
  });
  assert.strictEqual(diagFinal.body.focused_document.current_status, 'SELESAI');
  assert.strictEqual(diagFinal.body.focused_document.is_archived, true);
  const totalActiveInOffice = diagFinal.body.all_sections_map.reduce(
    (sum, s) => sum + s.active_documents_count,
    0
  );
  assert.strictEqual(totalActiveInOffice, 0, 'Archived document must no longer count as active stationed document');
  console.log('[PASS] Step 5: Complete lifecycle & archive reflection on Diagram verified.');

  // Clean up test records
  db.exec('DELETE FROM document_logs; DELETE FROM documents;');

  console.log('=== All Part 5 Checks Passed Successfully! ===');
}

runPart5Verification().catch((err) => {
  console.error('[FAIL] Part 5 Verification Failed:', err);
  process.exit(1);
});

