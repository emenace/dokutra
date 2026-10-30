const { db } = require('../config/database');

/**
 * Pad number to 2 digits
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Generate a unique Document Tracking ID based on DATE + TIME + SectionCode
 * Format: YYYYMMDD-HHMMSS-SECTIONCODE (e.g., 20261029-163540-PAPKI)
 * Ensures uniqueness in the SQLite documents table.
 * @param {string} sectionCode
 * @param {Date} [nowDate]
 * @returns {string}
 */
function generateUniqueDocTrackingId(sectionCode, nowDate = new Date()) {
  const cleanSection = String(sectionCode || 'SEKSI')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '');

  const datePart = `${nowDate.getFullYear()}${pad2(nowDate.getMonth() + 1)}${pad2(nowDate.getDate())}`;
  const timePart = `${pad2(nowDate.getHours())}${pad2(nowDate.getMinutes())}${pad2(nowDate.getSeconds())}`;
  const baseId = `${datePart}-${timePart}-${cleanSection}`;

  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM documents WHERE doc_tracking_id = ?');
  if (checkStmt.get(baseId).count === 0) {
    return baseId;
  }

  // If created within the exact same second by the same section, append a sequence counter
  let suffix = 1;
  while (true) {
    const candidate = `${baseId}-${suffix}`;
    if (checkStmt.get(candidate).count === 0) {
      return candidate;
    }
    suffix += 1;
  }
}

/**
 * Resolve Smart Routing for a document being forwarded from originSection to selectedTargetSection.
 *
 * Business Rules:
 * 1. HUMAS is never manually selected in the dropdown, because it acts as the mandatory bridge
 *    when targeting KASUBBAG or KEPALA from regular sections.
 * 2. If Target = KASUBBAG (from a regular section, i.e., not HUMAS and not KEPALA):
 *    - Immediate destination (pending_section): HUMAS
 *    - Planned subsequent route queue: ["KASUBBAG"]
 *    - Full path preview: [Origin, HUMAS, KASUBBAG]
 * 3. If Target = KEPALA:
 *    - From a regular section (not HUMAS, not KASUBBAG):
 *      Must go through HUMAS first, and must be reviewed by KASUBBAG first:
 *      - Immediate destination (pending_section): HUMAS
 *      - Planned subsequent route queue: ["KASUBBAG", "KEPALA"]
 *      - Full path preview: [Origin, HUMAS, KASUBBAG, KEPALA]
 *    - From HUMAS:
 *      Must be reviewed by KASUBBAG first:
 *      - Immediate destination (pending_section): KASUBBAG
 *      - Planned subsequent route queue: ["KEPALA"]
 *    - From KASUBBAG:
 *      Already reviewed by KASUBBAG, goes directly to KEPALA:
 *      - Immediate destination (pending_section): KEPALA
 *      - Planned subsequent route queue: []
 * 4. Standard section target (PTSP, KEPEGAWAIAN, PENMAD, BIMAS_ISLAM, PAPKI, KATOLIK, ZAKAT_WAKAF, KEUANGAN):
 *    - Immediate destination (pending_section): Selected Target Section
 *    - Planned subsequent route queue: []
 *
 * @param {number|string} fromSectionIdOrCode
 * @param {number|string} targetSectionIdOrCode
 * @returns {{
 *   fromSection: object,
 *   finalTargetSection: object,
 *   immediateNextSection: object,
 *   plannedRouteCodes: string[],
 *   plannedRouteSections: object[],
 *   fullRouteChain: object[],
 *   isAutoBridged: boolean,
 *   routingExplanation: string
 * }}
 */
function calculateSmartRoute(fromSectionIdOrCode, targetSectionIdOrCode) {
  const allSections = db.prepare('SELECT * FROM sections ORDER BY sort_order ASC').all();
  const byId = new Map(allSections.map((s) => [s.id, s]));
  const byCode = new Map(allSections.map((s) => [s.code.toUpperCase(), s]));

  const resolveSection = (val) => {
    if (typeof val === 'number' || /^\d+$/.test(String(val))) {
      return byId.get(Number(val));
    }
    return byCode.get(String(val).toUpperCase());
  };

  const fromSection = resolveSection(fromSectionIdOrCode);
  const finalTargetSection = resolveSection(targetSectionIdOrCode);
  const humasSection = byCode.get('HUMAS');
  const kasubbagSection = byCode.get('KASUBBAG');
  const kepalaSection = byCode.get('KEPALA');

  if (!fromSection) {
    throw new Error('Seksi pengirim tidak valid.');
  }
  if (!finalTargetSection) {
    throw new Error('Seksi tujuan tidak valid.');
  }
  if (finalTargetSection.code === 'HUMAS') {
    throw new Error('Humas Protokol tidak dapat dipilih secara manual karena otomatis menjadi jembatan ke Kasubbag TU / Kepala Kantor.');
  }

  let immediateNextSection = finalTargetSection;
  let plannedRouteCodes = [];
  let isAutoBridged = false;
  let routingExplanation = `Dokumen diteruskan langsung dari ${fromSection.short_name} ke ${finalTargetSection.short_name}.`;

  // Rule: Target is KASUBBAG
  if (finalTargetSection.code === 'KASUBBAG') {
    if (fromSection.code !== 'HUMAS' && fromSection.code !== 'KASUBBAG' && fromSection.code !== 'KEPALA') {
      immediateNextSection = humasSection;
      plannedRouteCodes = ['KASUBBAG'];
      isAutoBridged = true;
      routingExplanation = `Karena tujuan adalah Kasubbag TU, dokumen otomatis melewati Humas Protokol terlebih dahulu (${fromSection.short_name} → Humas Protokol → Kasubbag TU).`;
    }
  }

  // Rule: Target is KEPALA
  if (finalTargetSection.code === 'KEPALA') {
    if (fromSection.code === 'KASUBBAG') {
      immediateNextSection = kepalaSection;
      plannedRouteCodes = [];
      isAutoBridged = false;
      routingExplanation = 'Dokumen dari Kasubbag TU diteruskan langsung ke Kepala Kantor.';
    } else if (fromSection.code === 'HUMAS') {
      immediateNextSection = kasubbagSection;
      plannedRouteCodes = ['KEPALA'];
      isAutoBridged = true;
      routingExplanation = 'Dokumen menuju Kepala Kantor wajib direview oleh Kasubbag TU terlebih dahulu (Humas Protokol → Kasubbag TU → Kepala Kantor).';
    } else if (fromSection.code !== 'KEPALA') {
      immediateNextSection = humasSection;
      plannedRouteCodes = ['KASUBBAG', 'KEPALA'];
      isAutoBridged = true;
      routingExplanation = `Karena tujuan adalah Kepala Kantor, dokumen otomatis melalui Humas Protokol dan wajib direview Kasubbag TU terlebih dahulu (${fromSection.short_name} → Humas Protokol → Kasubbag TU → Kepala Kantor).`;
    }
  }

  const plannedRouteSections = plannedRouteCodes.map((code) => byCode.get(code)).filter(Boolean);
  const fullRouteChain = [fromSection, immediateNextSection, ...plannedRouteSections];

  return {
    fromSection,
    finalTargetSection,
    immediateNextSection,
    plannedRouteCodes,
    plannedRouteSections,
    fullRouteChain,
    isAutoBridged,
    routingExplanation
  };
}

module.exports = {
  generateUniqueDocTrackingId,
  calculateSmartRoute
};

