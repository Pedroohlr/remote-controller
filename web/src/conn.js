// Connection to the relay server: pairing token, auto-reconnect, latency and TV state.
import { useSyncExternalStore } from 'react';

const TOKEN_KEY = 'controle.token';
const NAME_KEY = 'controle.tv';

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

let state = {
  status: read(TOKEN_KEY) ? 'connecting' : 'unpaired', // unpaired | connecting | online | offline
  tvName: read(NAME_KEY) || 'TV',
  tvOnline: false,
  latency: null,
  tv: { now: null, volume: 30, muted: false, apps: [] },
  match: { active: false },
  newMatch: null,
};
const listeners = new Set();
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

let ws = null;
let retry = 0;
let retryTimer = null;
let pingTimer = null;

function connect() {
  const token = read(TOKEN_KEY);
  if (!token) return set({ status: 'unpaired' });
  clearTimeout(retryTimer);
  if (ws && ws.readyState <= 1) return;
  set({ status: 'connecting' });
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws/phone?token=${encodeURIComponent(token)}`);

  ws.onopen = () => {
    retry = 0;
    set({ status: 'online' });
    clearInterval(pingTimer);
    const ping = () => ws?.readyState === 1 && ws.send(JSON.stringify({ t: 'ping', at: performance.now() }));
    ping(); pingTimer = setInterval(ping, 5000);
  };
  ws.onmessage = (e) => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    switch (m.t) {
      case 'hello': write(NAME_KEY, m.tv); set({ tvName: m.tv, tvOnline: m.online, tv: { ...state.tv, ...m.state } }); break;
      case 'tv': set({ tvOnline: m.online }); break;
      case 'state': set({ tv: { ...state.tv, ...m.state } }); break;
      case 'pong': set({ latency: Math.round(performance.now() - m.at) }); break;
      case 'match': {
        const { newMatch, t, ...rest } = m;
        set({ match: rest, newMatch: newMatch ? (m.titles || state.match.titles || []).find((x) => x.key === newMatch) || null : state.newMatch });
        break;
      }
      case 'unpaired': write(TOKEN_KEY, null); set({ status: 'unpaired' }); break;
    }
  };
  ws.onclose = (e) => {
    clearInterval(pingTimer);
    ws = null;
    if (e.code === 4001 || !read(TOKEN_KEY)) return set({ status: 'unpaired' });
    set({ status: 'offline', tvOnline: false });
    retryTimer = setTimeout(connect, Math.min(8000, 400 * 2 ** retry++));
  };
}

// iOS suspends PWAs in the background: reconnect as soon as the app is visible again.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { retry = 0; connect(); } });
window.addEventListener('online', () => { retry = 0; connect(); });

const sendRaw = (obj) => { if (ws?.readyState === 1) { ws.send(JSON.stringify(obj)); return true; } return false; };

export const conn = {
  start: connect,
  cmd: (c) => sendRaw({ t: 'cmd', c }),
  volume: (v) => sendRaw({ t: 'vol', v }),
  open: (pkg) => sendRaw({ t: 'open', pkg }),
  text: (v) => sendRaw({ t: 'text', v }),
  vote: (key, like) => sendRaw({ t: 'vote', key, like }),
  clearMatchPopup: () => set({ newMatch: null }),
  async pair(code) {
    const r = await fetch('/api/pair', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: /iPhone/.test(navigator.userAgent) ? 'iPhone' : 'Celular' }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Não foi possível conectar.');
    write(TOKEN_KEY, j.token); write(NAME_KEY, j.tv);
    ws?.close(); ws = null; retry = 0;
    set({ tvName: j.tv });
    connect();
  },
  forget() { write(TOKEN_KEY, null); ws?.close(); set({ status: 'unpaired', tvOnline: false }); },
};

export function useConn() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}
