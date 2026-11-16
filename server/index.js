// Controle da TV — one process serves the PWA and relays commands phone ⇄ TV over WebSocket.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const WEB_DIR = path.resolve(__dirname, '../web/dist');
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// ───────── persistence (tiny JSON file; mount DATA_DIR as a volume in Easypanel)
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { tvs: {}, tokens: {} }; // tvs[id] = { secretHash, name }, tokens[hash] = { tv, name, createdAt }
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch {}
let saveTimer = null;
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db, null, 2));
    fs.renameSync(DB_FILE + '.tmp', DB_FILE);
  }, 200);
};
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// ───────── runtime state
const tvSockets = new Map();     // tvId -> ws
const phoneSockets = new Map();  // tvId -> Set<ws>
const tvState = new Map();       // tvId -> last state object from the TV
const pairCodes = new Map();     // code -> { tv, expires }
const attempts = new Map();      // ip -> { n, reset }
const matches = new Map();       // tvId -> { titles, votes: {token: {key: bool}}, players: [token] }

const send = (ws, obj) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const toPhones = (tv, obj) => { for (const ws of phoneSockets.get(tv) || []) send(ws, obj); };

function newPairCode(tv) {
  for (const [c, v] of pairCodes) if (v.tv === tv || v.expires < Date.now()) pairCodes.delete(c);
  let code;
  do { code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0'); } while (pairCodes.has(code));
  pairCodes.set(code, { tv, expires: Date.now() + 10 * 60_000 });
  return code;
}

function rateLimited(ip) {
  const now = Date.now();
  const a = attempts.get(ip) || { n: 0, reset: now + 10 * 60_000 };
  if (now > a.reset) { a.n = 0; a.reset = now + 10 * 60_000; }
  a.n++; attempts.set(ip, a);
  return a.n > 20;
}

// ───────── match (two paired phones vote on titles the TV sent)
function matchView(tv, token) {
  const m = matches.get(tv);
  if (!m) return { t: 'match', active: false };
  const mine = m.votes[token] || {};
  const other = m.players.find((p) => p !== token);
  const both = m.titles.filter((t) => m.players.length === 2 && m.players.every((p) => m.votes[p]?.[t.key] === true));
  return {
    t: 'match', active: true, titles: m.titles,
    voted: Object.keys(mine), otherCount: other ? Object.keys(m.votes[other] || {}).length : 0,
    players: m.players.length, matches: both.map((t) => t.key),
  };
}
function broadcastMatch(tv, newMatch) {
  for (const ws of phoneSockets.get(tv) || []) send(ws, { ...matchView(tv, ws.tokenHash), newMatch });
  const m = matches.get(tv);
  if (m) send(tvSockets.get(tv), {
    t: 'match', players: m.players.length,
    progress: m.players.map((p) => Object.keys(m.votes[p] || {}).length),
    matches: m.titles.filter((t) => m.players.length === 2 && m.players.every((p) => m.votes[p]?.[t.key] === true)).map((t) => t.key),
    newMatch,
  });
}

// ───────── HTTP: static PWA + pairing API
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function readBody(req) {
  return new Promise((resolve) => {
    let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e4) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  if (url.pathname === '/health') return json(res, 200, { ok: true, tvs: tvSockets.size });

  if (url.pathname === '/api/pair' && req.method === 'POST') {
    if (rateLimited(ip)) return json(res, 429, { error: 'Muitas tentativas. Espere alguns minutos.' });
    const { code, name } = await readBody(req);
    const p = pairCodes.get(String(code || ''));
    if (!p || p.expires < Date.now()) return json(res, 400, { error: 'Código inválido ou expirado. Gere outro na TV.' });
    pairCodes.delete(String(code));
    const token = crypto.randomBytes(32).toString('base64url');
    db.tokens[sha(token)] = { tv: p.tv, name: String(name || 'Celular').slice(0, 40), createdAt: Date.now() };
    save();
    send(tvSockets.get(p.tv), { t: 'paired', name: db.tokens[sha(token)].name });
    return json(res, 200, { token, tv: db.tvs[p.tv]?.name || 'TV' });
  }

  // static files; unknown paths fall back to index.html (single-page app)
  let file = path.join(WEB_DIR, decodeURIComponent(url.pathname));
  if (!file.startsWith(WEB_DIR)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_DIR, 'index.html');
  const ext = path.extname(file);
  const immutable = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).on('error', () => res.end()).pipe(res);
});

// ───────── WebSockets
const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/ws/tv') {
    const id = url.searchParams.get('id') || '';
    const secret = url.searchParams.get('secret') || '';
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(id) || secret.length < 24) return socket.destroy();
    const known = db.tvs[id];
    if (known && known.secretHash !== sha(secret)) return socket.destroy();
    if (!known) { db.tvs[id] = { secretHash: sha(secret), name: url.searchParams.get('name')?.slice(0, 40) || 'TV' }; save(); }
    return wss.handleUpgrade(req, socket, head, (ws) => onTv(ws, id));
  }
  if (url.pathname === '/ws/phone') {
    const token = url.searchParams.get('token') || '';
    const rec = db.tokens[sha(token)];
    if (!rec) return wss.handleUpgrade(req, socket, head, (ws) => { send(ws, { t: 'unpaired' }); ws.close(4001, 'unpaired'); });
    return wss.handleUpgrade(req, socket, head, (ws) => onPhone(ws, rec.tv, sha(token)));
  }
  socket.destroy();
});

function onTv(ws, id) {
  tvSockets.get(id)?.close(4000, 'replaced');
  tvSockets.set(id, ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  toPhones(id, { t: 'tv', online: true });
  syncPreview(id);

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    switch (m.t) {
      case 'state': {
        const prev = tvState.get(id) || {};
        const next = { ...prev, ...m.state };
        tvState.set(id, next);
        toPhones(id, { t: 'state', state: m.state });
        break;
      }
      case 'frame':
        for (const p of phoneSockets.get(id) || []) if (p.preview) send(p, { t: 'frame', d: m.d });
        break;
      case 'pairReq':
        send(ws, { t: 'pairCode', code: newPairCode(id), ttl: 600 });
        break;
      case 'matchStart': {
        const titles = (Array.isArray(m.titles) ? m.titles : []).slice(0, 30);
        const players = [...new Set([...(phoneSockets.get(id) || [])].map((p) => p.tokenHash))].slice(0, 2);
        matches.set(id, { titles, votes: {}, players });
        broadcastMatch(id);
        break;
      }
      case 'matchStop':
        matches.delete(id);
        toPhones(id, { t: 'match', active: false });
        break;
    }
  });
  ws.on('close', () => {
    if (tvSockets.get(id) === ws) { tvSockets.delete(id); toPhones(id, { t: 'tv', online: false }); }
  });
}

// Tell the TV to capture only while at least one phone is looking at the preview.
function syncPreview(tv) {
  const on = [...(phoneSockets.get(tv) || [])].some((p) => p.preview);
  send(tvSockets.get(tv), { t: 'preview', on });
}

const TV_COMMANDS = new Set(['up', 'down', 'left', 'right', 'ok', 'back', 'home', 'play', 'mute', 'power', 'volUp', 'volDown', 'enter']);

function onPhone(ws, tv, tokenHash) {
  ws.tokenHash = tokenHash;
  if (!phoneSockets.has(tv)) phoneSockets.set(tv, new Set());
  phoneSockets.get(tv).add(ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  send(ws, { t: 'hello', tv: db.tvs[tv]?.name || 'TV', online: tvSockets.has(tv), state: tvState.get(tv) || {} });
  send(ws, matchView(tv, tokenHash));

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const tvWs = tvSockets.get(tv);
    switch (m.t) {
      case 'ping': send(ws, { t: 'pong', at: m.at }); break;
      case 'preview': ws.preview = !!m.on; syncPreview(tv); break;
      case 'cmd': if (TV_COMMANDS.has(m.c)) send(tvWs, { t: 'cmd', c: m.c }); break;
      case 'vol': send(tvWs, { t: 'vol', v: Math.max(0, Math.min(100, Number(m.v) || 0)) }); break;
      case 'open': if (typeof m.pkg === 'string' && /^[\w.]+$/.test(m.pkg)) send(tvWs, { t: 'open', pkg: m.pkg }); break;
      case 'text': send(tvWs, { t: 'text', v: String(m.v ?? '').slice(0, 300) }); break;
      case 'vote': {
        const s = matches.get(tv);
        if (!s || typeof m.key !== 'string') break;
        if (!s.players.includes(tokenHash)) { if (s.players.length >= 2) break; s.players.push(tokenHash); }
        s.votes[tokenHash] ||= {};
        s.votes[tokenHash][m.key] = !!m.like;
        const other = s.players.find((p) => p !== tokenHash);
        const isMatch = m.like && other && s.votes[other]?.[m.key] === true;
        broadcastMatch(tv, isMatch ? m.key : undefined);
        break;
      }
    }
  });
  ws.on('close', () => { phoneSockets.get(tv)?.delete(ws); if (ws.preview) syncPreview(tv); });
}

// heartbeat: drop dead connections (phones sleeping, TV losing Wi-Fi)
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 25_000);

server.listen(PORT, () => console.log(`controle on :${PORT}`));
