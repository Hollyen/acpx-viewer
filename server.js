const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 7749;
const ACPX_DIR = path.join(os.homedir(), '.acpx');
const SESSIONS_DIR = path.join(ACPX_DIR, 'sessions');

// ─── helpers ────────────────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readNdjson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .filter(l => l.trim())
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ─── session reading ─────────────────────────────────────────────────────────

function getSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  const files = fs.readdirSync(SESSIONS_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('.stream'));
  return jsonFiles
    .map(f => readJson(path.join(SESSIONS_DIR, f)))
    .filter(Boolean)
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
}

function getSessionEvents(sessionId) {
  // find the ndjson stream file
  const files = fs.readdirSync(SESSIONS_DIR);
  const streamFile = files.find(f => f.startsWith(sessionId) && f.endsWith('.ndjson'));
  if (!streamFile) return [];
  return readNdjson(path.join(SESSIONS_DIR, streamFile));
}

// ─── queue / lock info ───────────────────────────────────────────────────────

function getQueueInfo() {
  const queuesDir = path.join(ACPX_DIR, 'queues');
  if (!fs.existsSync(queuesDir)) return [];
  return fs.readdirSync(queuesDir)
    .filter(f => f.endsWith('.lock'))
    .map(f => {
      const data = readJson(path.join(queuesDir, f));
      return data ? { file: f, ...data } : null;
    })
    .filter(Boolean);
}

// ─── HTTP router ─────────────────────────────────────────────────────────────

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data, null, 2));
}

function serveFile(res, filePath, contentType) {
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost`);
  const pathname = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' });
    res.end();
    return;
  }

  // API routes
  if (pathname === '/api/sessions') {
    return json(res, getSessions());
  }

  if (pathname.startsWith('/api/sessions/')) {
    const sessionId = pathname.replace('/api/sessions/', '').split('/')[0];
    const rest = pathname.replace(`/api/sessions/${sessionId}`, '');

    if (rest === '' || rest === '/') {
      const sessions = getSessions();
      const session = sessions.find(s => s.acpx_record_id === sessionId || s.acp_session_id === sessionId);
      return session ? json(res, session) : json(res, { error: 'Not found' }, 404);
    }

    if (rest === '/events') {
      return json(res, getSessionEvents(sessionId));
    }
  }

  if (pathname === '/api/queues') {
    return json(res, getQueueInfo());
  }

  if (pathname === '/api/config') {
    const cfg = readJson(path.join(ACPX_DIR, 'config.json'));
    return json(res, cfg || {});
  }

  // Static files
  const staticDir = path.join(__dirname, 'public');
  if (pathname === '/' || pathname === '/index.html') {
    return serveFile(res, path.join(staticDir, 'index.html'), 'text/html; charset=utf-8');
  }
  if (pathname.endsWith('.js')) {
    return serveFile(res, path.join(staticDir, pathname), 'application/javascript');
  }
  if (pathname.endsWith('.css')) {
    return serveFile(res, path.join(staticDir, pathname), 'text/css');
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`acpx-viewer running at http://localhost:${PORT}`);
  console.log(`Reading sessions from: ${SESSIONS_DIR}`);
});
