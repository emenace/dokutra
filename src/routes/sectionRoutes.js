const { db } = require('../config/database');

/**
 * Handle GET /api/sections
 * Returns all 11 sections and the filtered dropdown target sections (excluding Humas Protokol)
 */
function handleGetSections(req, res) {
  const allSections = db.prepare(`
    SELECT id, code, name, short_name, description, is_dropdown_target, sort_order
    FROM sections
    ORDER BY sort_order ASC
  `).all();

  const dropdownSections = allSections.filter((section) => section.is_dropdown_target === 1);

  return res.sendJson(200, {
    success: true,
    sections: allSections,
    dropdown_targets: dropdownSections
  });
}

module.exports = {
  handleGetSections
};

