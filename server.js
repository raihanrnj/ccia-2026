const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Active sessions memory store: token -> { createdAt, user }
const activeSessions = new Map();

function createSessionToken(username) {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, { createdAt: Date.now(), user: username });
  return token;
}

function destroySessionToken(token) {
  if (token) activeSessions.delete(token);
}

function extractSessionToken(req) {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)admin_session=([a-f0-9]+)/);
    if (match) return match[1];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

function isAuthenticated(req) {
  const token = extractSessionToken(req);
  if (!token) return false;
  const session = activeSessions.get(token);
  if (!session) return false;
  // Session expiry: 7 days
  if (Date.now() - session.createdAt > 7 * 24 * 3600 * 1000) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default initial state (Brand-Agnostic)
const DEFAULT_STATE = {
  title: "FINAL CCIA MUSLIMFEST 2026",
  subtitle: "CCIA 2026",
  currentRound: "1", // "1" = Babak Cepat, "2" = Babak Rebutan
  backgroundImage: "/assets/default-bg.svg",
  teams: [
    { id: "A", name: "REGU A", score: 0, color: "#38bdf8" },
    { id: "B", name: "REGU B", score: 0, color: "#facc15" },
    { id: "C", name: "REGU C", score: 0, color: "#f43f5e" }
  ],
  quickRound: {
    A: [false, false, false, false, false],
    B: [false, false, false, false, false],
    C: [false, false, false, false, false]
  },
  history: [],
  lastUpdated: Date.now()
};

let appState = loadState();

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_STATE,
        ...parsed,
        quickRound: parsed.quickRound || DEFAULT_STATE.quickRound,
        currentRound: parsed.currentRound || "1"
      };
    }
  } catch (err) {
    console.error("Error reading state file:", err);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function saveState() {
  try {
    appState.lastUpdated = Date.now();
    fs.writeFileSync(STATE_FILE, JSON.stringify(appState, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error writing state file:", err);
  }
}

// SSE Connected Clients
const sseClients = new Set();

function broadcastState(eventType = 'state', extraData = {}) {
  saveState();
  const payload = JSON.stringify({ state: appState, ...extraData });
  const message = `event: ${eventType}\ndata: ${payload}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) { // 25MB max for image uploads
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers for flexible local network access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // API: Authentication endpoints
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { username, password } = await readBody(req);
      if (username === ADMIN_USER && password === ADMIN_PASS) {
        const token = createSessionToken(username);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
        });
        res.end(JSON.stringify({ success: true, token, user: username }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Username atau password salah!' }));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = extractSessionToken(req);
    if (token) destroySessionToken(token);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/auth/check' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authenticated: isAuthenticated(req), user: ADMIN_USER }));
    return;
  }

  // Protect mutation APIs
  const PROTECTED_MUTATIONS = [
    '/api/round',
    '/api/quick-round',
    '/api/history/delete',
    '/api/score',
    '/api/score/batch',
    '/api/reset',
    '/api/undo',
    '/api/settings',
    '/api/upload-bg'
  ];

  if (PROTECTED_MUTATIONS.includes(pathname) && req.method === 'POST') {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized. Silakan login terlebih dahulu.' }));
      return;
    }
  }

  // SSE Endpoint
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    });
    res.write(`event: state\ndata: ${JSON.stringify({ state: appState })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // API: Get current state
  if (pathname === '/api/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(appState));
    return;
  }

  // API: Switch Round (Babak 1 / Babak 2)
  if (pathname === '/api/round' && req.method === 'POST') {
    try {
      const { round } = await readBody(req);
      if (round === '1' || round === '2') {
        appState.currentRound = round;
        broadcastState('round_update', { round });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, state: appState }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: Quick Round (Babak Pertanyaan Cepat 5 Soal)
  if (pathname === '/api/quick-round' && req.method === 'POST') {
    try {
      const { teamId, questions, delta } = await readBody(req);
      const team = appState.teams.find(t => t.id === teamId);
      if (!team) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Team not found' }));
        return;
      }

      if (Array.isArray(questions)) {
        appState.quickRound[teamId] = questions;
      }

      let scoreDelta = typeof delta === 'number' ? delta : 0;
      if (scoreDelta !== 0) {
        const prevScore = team.score;
        team.score += scoreDelta;

        const correctIndexes = (questions || [])
          .map((v, i) => v ? (i + 1) : null)
          .filter(Boolean);

        const changeRecord = {
          id: Date.now().toString() + '-' + teamId,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          round: "1",
          roundName: "Babak Cepat",
          teamId,
          teamName: team.name,
          prevScore,
          newScore: team.score,
          delta: scoreDelta,
          note: `Babak 1: ${correctIndexes.length}/5 Soal Benar (No ${correctIndexes.join(',')})`
        };

        appState.history.unshift(changeRecord);
        if (appState.history.length > 50) appState.history.pop();
        broadcastState('score_update', { change: changeRecord });
      } else {
        broadcastState('quick_round_update');
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, state: appState }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: Delete / Revert specific history record
  if (pathname === '/api/history/delete' && req.method === 'POST') {
    try {
      const { id } = await readBody(req);
      const idx = appState.history.findIndex(h => h.id === id);
      if (idx === -1) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Record not found' }));
        return;
      }

      const record = appState.history[idx];
      // Revert score if it was a specific team delta
      if (record.teamId && record.teamId !== 'ALL' && typeof record.delta === 'number') {
        const team = appState.teams.find(t => t.id === record.teamId);
        if (team) {
          team.score -= record.delta;
        }
      }

      // Remove from history
      appState.history.splice(idx, 1);
      broadcastState('history_revert', { reverted: record });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, state: appState, reverted: record }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: Update Score
  if (pathname === '/api/score' && req.method === 'POST') {
    try {
      const { teamId, delta, score, note, round } = await readBody(req);
      const team = appState.teams.find(t => t.id === teamId);
      if (!team) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Team not found' }));
        return;
      }

      const prevScore = team.score;
      if (typeof delta === 'number') {
        team.score += delta;
      } else if (typeof score === 'number') {
        team.score = score;
      }

      const currentRound = round || appState.currentRound || "2";
      const changeRecord = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('id-ID'),
        round: currentRound,
        roundName: currentRound === "1" ? "Babak Cepat" : "Babak Rebutan",
        teamId,
        teamName: team.name,
        prevScore,
        newScore: team.score,
        delta: team.score - prevScore,
        note: note || (team.score - prevScore >= 0 ? `+${team.score - prevScore}` : `${team.score - prevScore}`)
      };

      appState.history.unshift(changeRecord);
      if (appState.history.length > 50) appState.history.pop();

      broadcastState('score_update', { change: changeRecord });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, state: appState, change: changeRecord }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: Batch Update Scores
  if (pathname === '/api/batch-score' && req.method === 'POST') {
    try {
      const { updates } = await readBody(req); // Array of { teamId, delta, score }
      const changes = [];

      if (Array.isArray(updates)) {
        for (const up of updates) {
          const team = appState.teams.find(t => t.id === up.teamId);
          if (team) {
            const prevScore = team.score;
            if (typeof up.delta === 'number' && up.delta !== 0) {
              team.score += up.delta;
            } else if (typeof up.score === 'number' && up.score !== prevScore) {
              team.score = up.score;
            }

            if (team.score !== prevScore) {
              const rec = {
                id: Date.now().toString() + '-' + team.id,
                timestamp: new Date().toLocaleTimeString('id-ID'),
                teamId: team.id,
                teamName: team.name,
                prevScore,
                newScore: team.score,
                delta: team.score - prevScore,
                note: up.note || (team.score - prevScore >= 0 ? `+${team.score - prevScore}` : `${team.score - prevScore}`)
              };
              appState.history.unshift(rec);
              changes.push(rec);
            }
          }
        }
      }

      if (appState.history.length > 50) appState.history.length = 50;

      broadcastState('batch_update', { changes });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, state: appState, changes }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: Reset Scores
  if (pathname === '/api/reset' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const resetValue = typeof body.value === 'number' ? body.value : 0;
      appState.teams.forEach(t => {
        t.score = resetValue;
      });
      appState.history.unshift({
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('id-ID'),
        teamId: 'ALL',
        teamName: 'Semua Regu',
        prevScore: 0,
        newScore: resetValue,
        delta: 0,
        note: `Reset semua nilai ke ${resetValue}`
      });
      broadcastState('reset');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, state: appState }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: Undo last change
  if (pathname === '/api/undo' && req.method === 'POST') {
    try {
      if (appState.history.length > 0) {
        const lastRecord = appState.history.shift();
        if (lastRecord.teamId !== 'ALL') {
          const team = appState.teams.find(t => t.id === lastRecord.teamId);
          if (team) {
            team.score = lastRecord.prevScore;
          }
        }
        broadcastState('undo', { reverted: lastRecord });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, state: appState }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: Update Settings (Team names, colors, title, background)
  if (pathname === '/api/settings' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (body.title !== undefined) appState.title = body.title;
      if (body.subtitle !== undefined) appState.subtitle = body.subtitle;
      if (body.backgroundImage !== undefined) appState.backgroundImage = body.backgroundImage;
      if (Array.isArray(body.teams)) {
        body.teams.forEach(t => {
          const existing = appState.teams.find(e => e.id === t.id);
          if (existing) {
            if (t.name !== undefined) existing.name = t.name;
            if (t.color !== undefined) existing.color = t.color;
          }
        });
      }
      broadcastState('settings_update');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, state: appState }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: Upload Background Image (base64)
  if (pathname === '/api/upload-bg' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body.image) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No image data' }));
        return;
      }

      // Parse base64 data URI: data:image/png;base64,xxxxx
      const matches = body.image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid image format' }));
        return;
      }

      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const imageBuffer = Buffer.from(matches[2], 'base64');
      const filename = `bg-custom-${Date.now()}.${ext}`;
      const filePath = path.join(PUBLIC_DIR, 'assets', filename);

      fs.writeFileSync(filePath, imageBuffer);

      appState.backgroundImage = `/assets/${filename}`;
      broadcastState('bg_update');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, backgroundImage: appState.backgroundImage }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Static File Serving & Page Routing
  if (pathname === '/' || pathname === '/display') {
    serveStatic(res, path.join(PUBLIC_DIR, 'index.html'));
    return;
  }

  if (pathname === '/login' || pathname === '/admin/login') {
    if (isAuthenticated(req)) {
      res.writeHead(302, { 'Location': '/admin' });
      res.end();
      return;
    }
    serveStatic(res, path.join(PUBLIC_DIR, 'login.html'));
    return;
  }

  if (pathname === '/admin' || pathname === '/admin.html') {
    if (!isAuthenticated(req)) {
      res.writeHead(302, { 'Location': '/login' });
      res.end();
      return;
    }
    serveStatic(res, path.join(PUBLIC_DIR, 'admin.html'));
    return;
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  serveStatic(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🏆 CERDAS CERMAT - LIVE SCOREBOARD PLATFORM 🏆`);
  console.log(`====================================================`);
  console.log(`📺 LAYAR DISPLAY (TV/Proyektor): http://localhost:${PORT}/`);
  console.log(`⚙️  PANEL ADMIN (Operator):      http://localhost:${PORT}/admin`);
  console.log(`🔑 Login Bawaan:                Username: ${ADMIN_USER} | Password: ${ADMIN_PASS}`);
  console.log(`====================================================`);
});
