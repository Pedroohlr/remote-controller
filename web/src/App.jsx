import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { conn, useConn } from './conn.js';
import { Ic, Toast, spring, tap } from './ui.jsx';
import RemoteScreen from './screens/Remote.jsx';
import AppsScreen from './screens/Apps.jsx';
import TypeScreen from './screens/Type.jsx';
import MatchScreen from './screens/Match.jsx';
import { PairScreen, PairSheet } from './screens/Pair.jsx';

// Navigation is plain React state (no URL changes), so the iOS standalone app never shows Safari's bar.
const TABS = [
  { id: 'remote', n: 'Controle', Icon: Ic.remote, C: RemoteScreen },
  { id: 'apps', n: 'Apps', Icon: Ic.grid, C: AppsScreen },
  { id: 'type', n: 'Digitar', Icon: Ic.keys, C: TypeScreen },
  { id: 'match', n: 'Match', Icon: Ic.heart, C: MatchScreen },
];

function StatusChip({ onClick }) {
  const { tvName, tvOnline, status, latency } = useConn();
  const live = status === 'online' && tvOnline;
  const text = status === 'online' ? (tvOnline ? `${latency ?? '–'} ms` : 'TV desligada') : status === 'connecting' ? 'conectando' : 'sem internet';
  return (
    <motion.button whileTap={tap} className="chip" onClick={onClick} aria-label={`TV ${tvName}: ${text}. Trocar TV`}>
      <motion.span className={'dot ' + (live ? '' : status === 'connecting' ? 'dot-warn' : 'dot-off')}
        animate={status === 'connecting' ? { opacity: [1, 0.3, 1] } : { opacity: 1 }} transition={{ repeat: status === 'connecting' ? Infinity : 0, duration: 1.2 }} />
      {tvName}
      <span className="mono" style={{ color: 'var(--dim)', fontSize: 12 }}>{text}</span>
    </motion.button>
  );
}

function PowerButton({ notify }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
      <motion.button whileTap={tap} className="power" onClick={() => setOpen(!open)} aria-label="Desligar a TV" aria-expanded={open}><Ic.power size={19} /></motion.button>
      <AnimatePresence>
        {open && (
          <motion.div key="pop" className="popover" initial={{ opacity: 0, scale: 0.85, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={spring}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Desligar a TV?</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Para ligar de novo, use o controle físico.</div>
            <div className="popover-actions">
              <motion.button whileTap={tap} onClick={() => setOpen(false)}>Cancelar</motion.button>
              <motion.button whileTap={tap} className="danger" onClick={() => { setOpen(false); conn.cmd('power'); notify('Desligando a TV'); }}>Desligar</motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const { status } = useConn();
  const [tab, setTab] = useState(() => { try { return Number(sessionStorage.getItem('controle.tab')) || 0; } catch { return 0; } });
  const [dir, setDir] = useState(1);
  const [toast, setToast] = useState(null);
  const [sheet, setSheet] = useState(false);

  useEffect(() => { conn.start(); }, []);
  useEffect(() => { try { sessionStorage.setItem('controle.tab', String(tab)); } catch {} }, [tab]);

  const notify = useCallback((text, kind) => {
    const id = Math.random();
    setToast({ id, text, kind });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 2000);
  }, []);
  const go = (i) => { if (i === tab) return; setDir(i > tab ? 1 : -1); setTab(i); };
  const T = TABS[tab];

  if (status === 'unpaired') return <div className="app"><div className="halo" /><PairScreen /></div>;

  return (
    <div className="app">
      <div className="halo" />
      <Toast toast={toast} />

      <header className="top">
        <div>
          <StatusChip onClick={() => setSheet(true)} />
          <AnimatePresence mode="wait">
            <motion.h1 key={T.n} className="screen-title"
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }} transition={{ duration: 0.22 }}>
              {T.n}
            </motion.h1>
          </AnimatePresence>
        </div>
        <PowerButton notify={notify} />
      </header>

      <main className="stage">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.section key={T.id} custom={dir} className="screen"
            variants={{
              in: (d) => ({ opacity: 0, x: d * 40, filter: 'blur(8px)' }),
              on: { opacity: 1, x: 0, filter: 'blur(0px)' },
              out: (d) => ({ opacity: 0, x: d * -40, filter: 'blur(8px)' }),
            }}
            initial="in" animate="on" exit="out" transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
            <T.C notify={notify} />
          </motion.section>
        </AnimatePresence>
      </main>

      <nav className="dock glass" aria-label="Seções">
        {TABS.map((t, i) => (
          <motion.button key={t.id} onClick={() => go(i)} whileTap={{ scale: 0.9 }} aria-label={t.n} aria-current={tab === i ? 'page' : undefined} className={tab === i ? 'on' : ''}>
            {tab === i && <motion.span layoutId="tabpill" transition={spring} className="dock-pill" />}
            <motion.span animate={{ y: tab === i ? -1 : 0, scale: tab === i ? 1.08 : 1 }} transition={spring} style={{ position: 'relative', display: 'grid' }}><t.Icon size={21} /></motion.span>
            <span className="dock-label">{t.n}</span>
          </motion.button>
        ))}
      </nav>

      <PairSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}
