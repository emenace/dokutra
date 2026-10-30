const assert = require('node:assert');
const { db, initializeDatabase } = require('../src/config/database');
const { handleLogin } = require('../src/routes/authRoutes');
const {
  handleCreateDocument,
  handleGetInboxDocuments,
  handleReviewDocument
} = require('../src/routes/documentRoutes');

function invokeHandler(handler, { method = 'GET', url = '/', headers = {}, body = {}, paramId = null } = {}) {
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

async function runPart4Verification() {
  console.log('=== Starting Part 4 Verification Suite ===');

  initializeDatabase();

  // Clean up test documents
  db.exec('DELETE FROM document_logs; DELETE FROM documents;');

  const papkiCookie = loginAs('papki');
  const kepegawaianCookie = loginAs('kepegawaian');
  const humasCookie = loginAs('humas');
  const kasubbagCookie = loginAs('kasubbag');
  const kepalaCookie = loginAs('kepala');

  const kepegawaianSec = db.prepare("SELECT id FROM sections WHERE code = 'KEPEGAWAIAN'").get();
  const kepalaSec = db.prepare("SELECT id FROM sections WHERE code = 'KEPALA'").get();

  // Step 1: PAPKI creates a document and forwards to KEPEGAWAIAN (for initial paraf)
  // Document must be AUTO-RECEIVED at KEPEGAWAIAN immediately!
  const createRes = invokeHandler(handleCreateDocument, {
    method: 'POST',
    headers: { cookie: papkiCookie },
    body: {
      doc_date: '2026-10-30',
      doc_number: 'B-205/Kk.08.07/PP.00/10/2026',
      subject: 'Berkas Usulan SK Guru PAI',
      classification: 'Penting',
      description: 'Mohon paraf Kepegawaian sebelum ke Kepala Kantor',
      target_section_id: kepegawaianSec.id
    }
  });
  assert.strictEqual(createRes.statusCode, 201);
  const docId = createRes.body.document.id;
  assert.strictEqual(createRes.body.document.current_section_code, 'KEPEGAWAIAN', 'Must auto-receive at KEPEGAWAIAN');
  assert.strictEqual(createRes.body.document.current_status, 'DITERIMA', 'Status must be DITERIMA (auto-received)');
  assert.strictEqual(createRes.body.document.pending_section_code, 'KEPEGAWAIAN', 'Must flag KEPEGAWAIAN for review');
  console.log('[PASS] Step 1: PAPKI created document -> Auto-received (DITERIMA) & awaiting review at KEPEGAWAIAN.');

  // Step 2: KEPEGAWAIAN checks Inbox (Big Notification Banner data)
  const kepegInbox = invokeHandler(handleGetInboxDocuments, {
    headers: { cookie: kepegawaianCookie }
  });
  assert.strictEqual(kepegInbox.statusCode, 200);
  assert.strictEqual(kepegInbox.body.incoming_count, 1, 'KEPEGAWAIAN must see 1 incoming document notification');
  console.log('[PASS] Step 2: KEPEGAWAIAN receives Big Incoming Notification (incoming_count = 1).');

  // Step 3: KEPEGAWAIAN tests "Tolak" (DITOLAK) option
  const kepegReject = invokeHandler(handleReviewDocument, {
    method: 'POST',
    headers: { cookie: kepegawaianCookie },
    paramId: docId,
    body: {
      action_status: 'DITOLAK',
      note: 'Lampiran sempat kurang 1 lembar (tes status Tolak)'
    }
  });
  assert.strictEqual(kepegReject.statusCode, 200);
  assert.strictEqual(kepegReject.body.document.current_section_code, 'KEPEGAWAIAN');
  assert.strictEqual(kepegReject.body.document.current_status, 'DITOLAK');
  console.log('[PASS] Step 3: KEPEGAWAIAN selected Tolak -> status is DITOLAK at KEPEGAWAIAN.');

  // Step 4: KEPEGAWAIAN selects "Teruskan" (TERUSKAN) and selects target = KEPALA KANTOR
  // Smart Routing must automatically route to HUMAS first (auto-received & menunggu at HUMAS) with planned_route ["KASUBBAG", "KEPALA"]
  const kepegForward = invokeHandler(handleReviewDocument, {
    method: 'POST',
    headers: { cookie: kepegawaianCookie },
    paramId: docId,
    body: {
      action_status: 'TERUSKAN',
      note: 'Lampiran lengkap & sudah diparaf Kepegawaian, diteruskan ke Kepala Kantor',
      target_section_id: kepalaSec.id
    }
  });
  assert.strictEqual(kepegForward.statusCode, 200);
  assert.strictEqual(kepegForward.body.document.current_section_code, 'HUMAS', 'Must auto-receive at HUMAS first');
  assert.strictEqual(kepegForward.body.document.current_status, 'DITERIMA');
  assert.strictEqual(kepegForward.body.document.pending_section_code, 'HUMAS');
  assert.strictEqual(kepegForward.body.document.is_return_from_pimpinan, false);
  assert.deepStrictEqual(kepegForward.body.document.planned_route, ['KASUBBAG', 'KEPALA']);
  console.log('[PASS] Step 4: KEPEGAWAIAN selected Teruskan to KEPALA -> auto-received & menunggu at HUMAS first.');

  // Step 5: HUMAS checks Inbox and selects "Teruskan" (advances & auto-receives at KASUBBAG)
  const humasInbox = invokeHandler(handleGetInboxDocuments, {
    headers: { cookie: humasCookie }
  });
  assert.strictEqual(humasInbox.body.incoming_count, 1, 'HUMAS must see incoming document');

  const humasForward = invokeHandler(handleReviewDocument, {
    method: 'POST',
    headers: { cookie: humasCookie },
    paramId: docId,
    body: {
      action_status: 'TERUSKAN',
      note: 'Diantar Humas ke ruangan Kasubbag TU',
      target_section_id: kepalaSec.id
    }
  });
  assert.strictEqual(humasForward.body.document.current_section_code, 'KASUBBAG', 'Must auto-receive at KASUBBAG');
  assert.strictEqual(humasForward.body.document.pending_section_code, 'KASUBBAG', 'Must advance to KASUBBAG for mandatory review');
  assert.deepStrictEqual(humasForward.body.document.planned_route, ['KEPALA']);
  console.log('[PASS] Step 5: HUMAS selected Teruskan -> auto-received & menunggu at KASUBBAG TU.');

  // Step 6: KASUBBAG selects "Teruskan" -> advances & auto-receives at KEPALA
  const kasubbagForward = invokeHandler(handleReviewDocument, {
    method: 'POST',
    headers: { cookie: kasubbagCookie },
    paramId: docId,
    body: {
      action_status: 'TERUSKAN',
      note: 'ACC Kasubbag TU, diteruskan ke Kepala Kantor',
      target_section_id: kepalaSec.id
    }
  });
  assert.strictEqual(kasubbagForward.body.document.current_section_code, 'KEPALA', 'Must auto-receive at KEPALA');
  assert.strictEqual(kasubbagForward.body.document.pending_section_code, 'KEPALA');
  assert.strictEqual(kasubbagForward.body.document.current_status, 'DITERIMA');
  assert.deepStrictEqual(kasubbagForward.body.document.planned_route, []);
  console.log('[PASS] Step 6: KASUBBAG reviewed and selected Teruskan -> auto-received & menunggu at KEPALA KANTOR.');

  // Step 7: KEPALA KANTOR selects "Tandatangan dan Teruskan ke Protokol" (TERUSKAN_PROTOKOL, no dropdown needed!)
  const kepalaSignReturn = invokeHandler(handleReviewDocument, {
    method: 'POST',
    headers: { cookie: kepalaCookie },
    paramId: docId,
    body: {
      action_status: 'TERUSKAN_PROTOKOL',
      note: 'Sudah ditandatangani Kepala Kantor'
    }
  });
  assert.strictEqual(kepalaSignReturn.statusCode, 200);
  assert.strictEqual(kepalaSignReturn.body.document.current_section_code, 'HUMAS', 'Must auto-select HUMAS Protokol');
  assert.strictEqual(kepalaSignReturn.body.document.is_return_from_pimpinan, true, 'Must flag as return from pimpinan (Kepala/Kasubbag)');
  console.log('[PASS] Step 7: KEPALA selected "Tandatangan dan Teruskan ke Protokol" -> auto-routed to HUMAS without dropdown.');

  // Step 8: HUMAS receives document back from KEPALA and selects "Teruskan ke Seksi" (TERUSKAN_SEKSI, source section PAPKI auto-selected without dropdown!)
  const humasReturnToSource = invokeHandler(handleReviewDocument, {
    method: 'POST',
    headers: { cookie: humasCookie },
    paramId: docId,
    body: {
      action_status: 'TERUSKAN_SEKSI',
      note: 'Dokumen diserahkan kembali ke seksi asal'
    }
  });
  assert.strictEqual(humasReturnToSource.statusCode, 200);
  assert.strictEqual(humasReturnToSource.body.document.current_section_code, 'PAPKI', 'Must auto-select source section PAPKI');
  assert.strictEqual(humasReturnToSource.body.document.current_status, 'DITERIMA');
  assert.strictEqual(
    humasReturnToSource.body.document.is_returned_signed_to_origin,
    true,
    'Document returned from HUMAS after being signed by pimpinan must flag is_returned_signed_to_origin = true'
  );
  console.log('[PASS] Step 8: HUMAS selected "Teruskan ke Seksi" -> auto-selected source section PAPKI without dropdown.');

  // Step 9: Origin section (PAPKI) receives signed document back from HUMAS, sees only "Selesai", and marks "SELESAI" (Archived)
  const papkiFinishArchive = invokeHandler(handleReviewDocument, {
    method: 'POST',
    headers: { cookie: papkiCookie },
    paramId: docId,
    body: {
      action_status: 'SELESAI',
      note: 'Dokumen telah selesai dan disimpan ke Arsip PAPKI'
    }
  });
  assert.strictEqual(papkiFinishArchive.statusCode, 200);
  assert.strictEqual(papkiFinishArchive.body.document.current_status, 'SELESAI');
  assert.strictEqual(papkiFinishArchive.body.document.is_archived, true, 'Document must be marked as archived');
  assert.strictEqual(papkiFinishArchive.body.document.pending_section_id, null);
  console.log('[PASS] Step 9: Origin section PAPKI selected "Selesai" -> document marked SELESAI and moved to Arsip.');

  // Clean up test records
  db.exec('DELETE FROM document_logs; DELETE FROM documents;');

  console.log('=== All Part 4 Checks Passed Successfully! ===');
}

runPart4Verification().catch((err) => {
  console.error('[FAIL] Part 4 Verification Failed:', err);
  process.exit(1);
});

