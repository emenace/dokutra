const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'dokutra.sqlite');
const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for concurrency and data integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Hash password using scrypt with deterministic or random salt
 * @param {string} password
 * @returns {string} salt:hash
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verify password against stored hash
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * Initialize database schema and seed the 11 office sections and default PIC accounts
 */
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      description TEXT,
      is_dropdown_target INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      section_id INTEGER NOT NULL,
      theme_mode TEXT NOT NULL DEFAULT 'light' CHECK(theme_mode IN ('light', 'dark')),
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (section_id) REFERENCES sections(id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_tracking_id TEXT NOT NULL UNIQUE,
      doc_date TEXT NOT NULL,
      doc_number TEXT DEFAULT '',
      subject TEXT NOT NULL,
      classification TEXT NOT NULL CHECK(classification IN ('Biasa', 'Penting', 'Rahasia')),
      description TEXT DEFAULT '',
      origin_section_id INTEGER NOT NULL,
      current_section_id INTEGER NOT NULL,
      pending_section_id INTEGER,
      final_target_section_id INTEGER,
      current_status TEXT NOT NULL CHECK(current_status IN ('DITERUSKAN', 'DITERIMA', 'DIPROSES')),
      planned_route_json TEXT DEFAULT '[]',
      created_by_user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (origin_section_id) REFERENCES sections(id),
      FOREIGN KEY (current_section_id) REFERENCES sections(id),
      FOREIGN KEY (pending_section_id) REFERENCES sections(id),
      FOREIGN KEY (final_target_section_id) REFERENCES sections(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS document_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      from_section_id INTEGER NOT NULL,
      to_section_id INTEGER NOT NULL,
      action_status TEXT NOT NULL CHECK(action_status IN ('DIBUAT', 'DITERIMA', 'DIPROSES', 'DITERUSKAN')),
      note TEXT DEFAULT '',
      action_by_user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (from_section_id) REFERENCES sections(id),
      FOREIGN KEY (to_section_id) REFERENCES sections(id),
      FOREIGN KEY (action_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      sess TEXT NOT NULL,
      expire INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Seed the 11 Official Sections of Kantor Kementerian Agama Kota Metro
  const existingSectionsCount = db.prepare('SELECT COUNT(*) as count FROM sections').get().count;

  if (existingSectionsCount === 0) {
    const sectionsSeed = [
      {
        code: 'PTSP',
        name: 'PTSP (Pelayanan Terpadu Satu Pintu)',
        short_name: 'PTSP',
        description: 'Pelayanan Terpadu Satu Pintu - Pintu utama penerimaan surat masuk',
        is_dropdown_target: 1,
        sort_order: 1,
        default_username: 'ptsp',
        default_pic_name: 'PIC PTSP'
      },
      {
        code: 'KEPEGAWAIAN',
        name: 'Kepegawaian',
        short_name: 'Kepegawaian',
        description: 'Urusan Kepegawaian dan pembuatan surat keluar',
        is_dropdown_target: 1,
        sort_order: 2,
        default_username: 'kepegawaian',
        default_pic_name: 'PIC Kepegawaian'
      },
      {
        code: 'PENMAD',
        name: 'PENMAD (Pendidikan Madrasah)',
        short_name: 'PENMAD',
        description: 'Seksi Pendidikan Madrasah - Integrasi sekolah dan guru madrasah',
        is_dropdown_target: 1,
        sort_order: 3,
        default_username: 'penmad',
        default_pic_name: 'PIC PENMAD'
      },
      {
        code: 'BIMAS_ISLAM',
        name: 'BIMAS ISLAM (Bimbingan Masyarakat Islam)',
        short_name: 'BIMAS ISLAM',
        description: 'Seksi Bimbingan Masyarakat Islam, Penyuluh Agama, dan KUA Kecamatan',
        is_dropdown_target: 1,
        sort_order: 4,
        default_username: 'bimas',
        default_pic_name: 'PIC Bimas Islam'
      },
      {
        code: 'PAPKI',
        name: 'PAPKI (Pendidikan Agama dan Keagamaan Islam)',
        short_name: 'PAPKI',
        description: 'Seksi Pondok Pesantren dan Guru PAI pada Sekolah Umum',
        is_dropdown_target: 1,
        sort_order: 5,
        default_username: 'papki',
        default_pic_name: 'PIC PAPKI'
      },
      {
        code: 'KATOLIK',
        name: 'Penyelenggara Katolik',
        short_name: 'Katolik',
        description: 'Penyelenggara Bimbingan Masyarakat Katolik & Non-Muslim',
        is_dropdown_target: 1,
        sort_order: 6,
        default_username: 'katolik',
        default_pic_name: 'PIC Penyelenggara Katolik'
      },
      {
        code: 'ZAKAT_WAKAF',
        name: 'Penyelenggara Zakat Wakaf',
        short_name: 'Zakat Wakaf',
        description: 'Penyelenggara Zakat, Wakaf, Infaq, dan Sedekah',
        is_dropdown_target: 1,
        sort_order: 7,
        default_username: 'zakatwakaf',
        default_pic_name: 'PIC Zakat Wakaf'
      },
      {
        code: 'KEUANGAN',
        name: 'Perencana Keuangan',
        short_name: 'Keuangan',
        description: 'Perencanaan, Keuangan, dan Perbendaharaan',
        is_dropdown_target: 1,
        sort_order: 8,
        default_username: 'keuangan',
        default_pic_name: 'PIC Perencana Keuangan'
      },
      {
        code: 'KASUBBAG',
        name: 'Kasubbag Tata Usaha',
        short_name: 'KASUBBAG TU',
        description: 'Kepala Sub Bagian Tata Usaha - Persetujuan Administrasi',
        is_dropdown_target: 1,
        sort_order: 9,
        default_username: 'kasubbag',
        default_pic_name: 'Kasubbag Tata Usaha'
      },
      {
        code: 'KEPALA',
        name: 'Kepala Kantor',
        short_name: 'KEPALA KANTOR',
        description: 'Kepala Kantor Kementerian Agama Kota Metro',
        is_dropdown_target: 1,
        sort_order: 10,
        default_username: 'kepala',
        default_pic_name: 'Kepala Kantor'
      },
      {
        code: 'HUMAS',
        name: 'Humas Protokol',
        short_name: 'Humas Protokol',
        description: 'Hubungan Masyarakat & Protokol - Penghubung seksi ke Kasubbag TU dan Kepala Kantor',
        is_dropdown_target: 0, // Never shown in manual target dropdown; auto-selected bridge
        sort_order: 11,
        default_username: 'humas',
        default_pic_name: 'PIC Humas Protokol'
      }
    ];

    const insertSectionStmt = db.prepare(`
      INSERT INTO sections (code, name, short_name, description, is_dropdown_target, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertUserStmt = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, section_id, theme_mode)
      VALUES (?, ?, ?, ?, 'light')
    `);

    // Default password for all initial PIC accounts is "123456"
    const defaultPasswordHash = hashPassword('123456');

    db.exec('BEGIN TRANSACTION');
    try {
      for (const item of sectionsSeed) {
        const result = insertSectionStmt.run(
          item.code,
          item.name,
          item.short_name,
          item.description,
          item.is_dropdown_target,
          item.sort_order
        );
        const sectionId = Number(result.lastInsertRowid);

        insertUserStmt.run(
          item.default_username,
          defaultPasswordHash,
          item.default_pic_name,
          sectionId
        );
      }
      db.exec('COMMIT');
      console.log('[Database] Successfully seeded 11 sections and 11 PIC user accounts.');
    } catch (error) {
      db.exec('ROLLBACK');
      console.error('[Database] Failed to seed initial data:', error);
      throw error;
    }
  }
}

module.exports = {
  db,
  initializeDatabase,
  hashPassword,
  verifyPassword
};

