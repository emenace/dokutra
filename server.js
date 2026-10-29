const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { initializeDatabase } = require('./src/config/database');
const {
  handleLogin,
  handleLogout,
  handleGetMe,
  handleUpdateTheme,
  handleGetAccountsList
} = require('./src/routes/authRoutes');
const { handleGetSections } = require('./src/routes/sectionRoutes');

// Initialize SQLite tables and 11 office section seeds on startup
initializeDatabase();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Parse JSON request body
 * @param {http.IncomingMessage} req
 * @returns {Promise<object>}
 */
function parseJsonBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/**
 * Create HTTP server handling API endpoints and static frontend assets
 */
function createAppServer() {
  return http.createServer(async (req, res) => {
    // Helper method to send JSON responses
    res.sendJson = (statusCode, payload) => {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify(payload));
    };

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    try {
      // --- Auth & Session Routes (Part 1) ---
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseJsonBody(req);
        return handleLogin(req, res, body);
      }

      if (pathname === '/api/auth/logout' && method === 'POST') {
        return handleLogout(req, res);
      }

      if (pathname === '/api/auth/me' && method === 'GET') {
        return handleGetMe(req, res);
      }

      if (pathname === '/api/auth/theme' && method === 'PUT') {
        const body = await parseJsonBody(req);
        return handleUpdateTheme(req, res, body);
      }

      if (pathname === '/api/auth/accounts' && method === 'GET') {
        return handleGetAccountsList(req, res);
      }

      // --- Section Master Routes ---
      if (pathname === '/api/sections' && method === 'GET') {
        return handleGetSections(req, res);
      }

      // Unknown API route
      if (pathname.startsWith('/api/')) {
        return res.sendJson(404, {
          success: false,
          message: 'Endpoint API tidak ditemukan.'
        });
      }

      // --- Static File Serving for Mobile Webview UI ---
      let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);

      // Prevent directory traversal outside PUBLIC_DIR
      if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        return res.end('Forbidden');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
      } else {
        // Fallback to index.html for SPA navigation
        const indexHtmlPath = path.join(PUBLIC_DIR, 'index.html');
        if (fs.existsSync(indexHtmlPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          fs.createReadStream(indexHtmlPath).pipe(res);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      }
    } catch (error) {
      console.error('[Server Error]:', error);
      return res.sendJson(500, {
        success: false,
        message: 'Terjadi kesalahan pada server.'
      });
    }
  });
}

if (require.main === module) {
  const server = createAppServer();
  server.listen(PORT, () => {
    console.log(`[DOKUTRA] Server running on http://localhost:${PORT}`);
  });
}

module.exports = { createAppServer };

