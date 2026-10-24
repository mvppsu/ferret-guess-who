'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const BUNDLED_ROSTER = path.join(ROOT, 'art', 'ferrets.json');
// DATA_DIR holds ferrets.json and images/. In Docker it is a mounted volume.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'art'));
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const ROSTER_FILE = path.join(DATA_DIR, 'ferrets.json');

const MAX_ROOMS = 500;
const ROOM_IDLE_MS = 6 * 60 * 60 * 1000;
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: easy to misread
const IMAGE_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---------- roster ----------

// First run: create the data folder and drop in the default ferrets.json so it can be edited.
// If the folder is read-only the app still works from the bundled copy.
try {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  if (!fs.existsSync(ROSTER_FILE)) fs.copyFileSync(BUNDLED_ROSTER, ROSTER_FILE);
} catch (e) {
  console.warn(`Could not prepare ${DATA_DIR}: ${e.message}`);
}

// Images are matched by file stem ("01-bandit") or just the id ("01"), any of webp/png/jpg.
function loadRoster() {
  const raw = JSON.parse(fs.readFileSync(fs.existsSync(ROSTER_FILE) ? ROSTER_FILE : BUNDLED_ROSTER, 'utf8'));
  const images = new Map();
  const files = fs.existsSync(IMAGES_DIR) ? fs.readdirSync(IMAGES_DIR) : [];
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (IMAGE_EXTS.has(ext)) images.set(path.basename(f, path.extname(f)).toLowerCase(), f);
  }
  const ferrets = raw.ferrets.map((f) => {
    const stem = path.basename(f.file, path.extname(f.file)).toLowerCase();
    const found = images.get(stem) || images.get(f.id);
    let image = null;
    if (found) {
      const v = Math.floor(fs.statSync(path.join(IMAGES_DIR, found)).mtimeMs);
      image = `/images/${encodeURIComponent(found)}?v=${v}`;
    }
    return { id: f.id, name: f.name, coat: f.coat, pose: f.pose, accessory: f.accessory, image };
  });
  return { ferrets, coats: raw.coats, poses: raw.poses, accessories: raw.accessories };
}

function rosterIds() {
  return new Set(loadRoster().ferrets.map((f) => f.id));
}

// ---------- game state ----------

const rooms = new Map();

function newCode() {
  for (let tries = 0; tries < 200; tries++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_LETTERS[crypto.randomInt(CODE_LETTERS.length)];
    if (!rooms.has(code)) return code;
  }
  return null;
}

function cleanName(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 14);
  return n || 'Player';
}

function makePlayer(name) {
  return {
    token: crypto.randomBytes(16).toString('hex'),
    name: cleanName(name),
    ws: null,
    secret: null,
    locked: false,
    down: new Set(),
    again: false,
  };
}

function resetPlayerRound(p) {
  p.secret = null;
  p.locked = false;
  p.down = new Set();
  p.again = false;
}

function isConnected(p) {
  return !!p.ws && p.ws.readyState === WebSocket.OPEN;
}

function send(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function snapshot(room, p) {
  const o = room.players.find((x) => x !== p) || null;
  const snap = {
    type: 'state',
    code: room.code,
    phase: room.phase,
    you: { name: p.name, secret: p.secret, locked: p.locked, down: [...p.down], again: p.again },
    opp: o ? { name: o.name, connected: isConnected(o), locked: o.locked, again: o.again } : null,
    myTurn: room.phase === 'playing' && room.players[room.turn] === p,
    scores: { you: room.scores.get(p.token) || 0, opp: o ? room.scores.get(o.token) || 0 : 0 },
    result: null,
  };
  if (room.phase === 'over' && room.result && o) {
    snap.result = {
      youWon: room.result.winner === p.token,
      youGuessed: room.result.guesser === p.token,
      guessId: room.result.guessId,
      yourSecret: p.secret,
      oppSecret: o.secret,
    };
  }
  return snap;
}

function broadcast(room) {
  room.touched = Date.now();
  for (const p of room.players) send(p.ws, snapshot(room, p));
}

function createRoom(ws, name) {
  if (rooms.size >= MAX_ROOMS) return send(ws, { type: 'error', message: 'The server is full. Try again later.' });
  const code = newCode();
  if (!code) return send(ws, { type: 'error', message: 'Could not make a room code.' });
  const p = makePlayer(name);
  const room = {
    code,
    phase: 'waiting',
    players: [p],
    turn: 0,
    starter: Math.round(Math.random()),
    scores: new Map([[p.token, 0]]),
    result: null,
    touched: Date.now(),
  };
  rooms.set(code, room);
  attach(ws, room, p);
}

function joinRoom(ws, code, name) {
  const room = rooms.get(String(code || '').toUpperCase().trim());
  if (!room) return send(ws, { type: 'error', message: 'No game with that code. Check the letters.' });
  if (room.players.length >= 2) return send(ws, { type: 'error', message: 'That game already has two players.' });
  const p = makePlayer(name);
  if (room.players[0].name === p.name) p.name = `${p.name} 2`.slice(0, 14);
  room.players.push(p);
  room.scores.set(p.token, 0);
  room.phase = 'picking';
  room.result = null;
  room.players.forEach(resetPlayerRound);
  attach(ws, room, p);
}

function rejoinRoom(ws, code, token) {
  const room = rooms.get(String(code || '').toUpperCase().trim());
  const p = room && room.players.find((x) => x.token === token);
  if (!p) return send(ws, { type: 'rejoinFailed' });
  if (p.ws && p.ws !== ws) {
    p.ws.ctx = null;
    p.ws.close();
  }
  attach(ws, room, p);
}

function attach(ws, room, p) {
  p.ws = ws;
  ws.ctx = { room, player: p };
  send(ws, { type: 'joined', code: room.code, token: p.token, name: p.name });
  broadcast(room);
}

function removePlayer(room, p) {
  room.players = room.players.filter((x) => x !== p);
  room.scores.delete(p.token);
  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }
  const rest = room.players[0];
  room.phase = 'waiting';
  room.result = null;
  room.scores.set(rest.token, 0);
  resetPlayerRound(rest);
  send(rest.ws, { type: 'notice', message: `${p.name} left the game.` });
  broadcast(room);
}

function handleGame(room, p, msg, validIds) {
  const opp = room.players.find((x) => x !== p);
  switch (msg.type) {
    case 'sync':
      return send(p.ws, snapshot(room, p));

    case 'secret':
      if (room.phase !== 'picking' || p.locked || !validIds.has(msg.id)) return;
      p.secret = msg.id;
      p.locked = true;
      if (opp && opp.locked) {
        room.phase = 'playing';
        room.turn = room.starter;
      }
      return broadcast(room);

    case 'flip':
      if (room.phase !== 'playing' || !validIds.has(msg.id)) return;
      if (msg.down) p.down.add(msg.id);
      else p.down.delete(msg.id);
      return send(p.ws, snapshot(room, p));

    case 'endTurn':
      if (room.phase !== 'playing' || room.players[room.turn] !== p) return;
      room.turn = 1 - room.turn;
      return broadcast(room);

    case 'guess': {
      if (room.phase !== 'playing' || room.players[room.turn] !== p || !validIds.has(msg.id) || !opp) return;
      const correct = msg.id === opp.secret;
      const winner = correct ? p : opp;
      room.scores.set(winner.token, (room.scores.get(winner.token) || 0) + 1);
      room.result = { winner: winner.token, guesser: p.token, guessId: msg.id };
      room.phase = 'over';
      return broadcast(room);
    }

    case 'again':
      if (room.phase !== 'over') return;
      p.again = true;
      if (opp && opp.again) {
        room.players.forEach(resetPlayerRound);
        room.phase = 'picking';
        room.result = null;
        room.starter = 1 - room.starter;
      }
      return broadcast(room);

    case 'leave':
      detach(p);
      return removePlayer(room, p);
  }
}

function detach(p) {
  const ws = p.ws;
  if (ws) ws.ctx = null;
  p.ws = null;
}

// ---------- http ----------

function sendFile(res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cache,
    });
    fs.createReadStream(file).pipe(res);
  });
}

function safeJoin(base, rel) {
  const full = path.resolve(base, '.' + path.sep + rel);
  return full === base || full.startsWith(base + path.sep) ? full : null;
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }

  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  if (pathname === '/api/ferrets') {
    try {
      const body = JSON.stringify(loadRoster());
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
      return res.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end(`Could not read ferrets.json: ${e.message}`);
    }
  }
  if (pathname.startsWith('/images/')) {
    const file = safeJoin(IMAGES_DIR, pathname.slice('/images/'.length));
    if (!file) {
      res.writeHead(403);
      return res.end();
    }
    return sendFile(res, file, 'public, max-age=31536000, immutable');
  }
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = safeJoin(PUBLIC_DIR, rel);
  if (!file) {
    res.writeHead(403);
    return res.end();
  }
  sendFile(res, file, 'no-cache');
});

// ---------- websocket ----------

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.ctx = null;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'create') return createRoom(ws, msg.name);
    if (msg.type === 'join') return joinRoom(ws, msg.code, msg.name);
    if (msg.type === 'rejoin') return rejoinRoom(ws, msg.code, msg.token);
    if (!ws.ctx) return send(ws, { type: 'rejoinFailed' });

    const { room, player } = ws.ctx;
    let ids;
    try {
      ids = rosterIds();
    } catch {
      return send(ws, { type: 'error', message: 'ferrets.json is unreadable on the server.' });
    }
    handleGame(room, player, msg, ids);
  });

  ws.on('close', () => {
    if (!ws.ctx) return;
    const { room, player } = ws.ctx;
    if (player.ws === ws) {
      player.ws = null;
      broadcast(room);
    }
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 25000);

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.touched > ROOM_IDLE_MS && !room.players.some(isConnected)) rooms.delete(code);
  }
}, 10 * 60 * 1000);

server.on('close', () => {
  clearInterval(heartbeat);
  clearInterval(sweeper);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ferret Guess Who listening on :${PORT} (data: ${DATA_DIR})`);
});

function shutdown() {
  wss.clients.forEach((c) => c.close());
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
