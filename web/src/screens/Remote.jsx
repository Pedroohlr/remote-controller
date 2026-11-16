import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { conn, useConn, useFrame } from '../conn.js';
import { Ic, Segmented, spring, soft, tap } from '../ui.jsx';

const LABEL = { up: 'Cima', down: 'Baixo', left: 'Esquerda', right: 'Direita', ok: 'OK', back: 'Voltar', home: 'Início', play: 'Play / Pausa', mute: 'Mudo' };
const STEP = 60; // px of finger travel per D-pad step
const ARROW_POS = {
  up: { top: 18, left: '50%', x: '-50%', rotate: -90 }, down: { bottom: 18, left: '50%', x: '-50%', rotate: 90 },
  left: { left: 18, top: '50%', y: '-50%', rotate: 180 }, right: { right: 18, top: '50%', y: '-50%', rotate: 0 },
};

function Touchpad({ send }) {
  const ref = useRef(null);
  const x = useMotionValue(0), y = useMotionValue(0);
  const [touching, setTouching] = useState(false);
  const [ripples, setRipples] = useState([]);
  const [arrow, setArrow] = useState(null);
  const st = useRef({});

  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const fire = (dir) => { send(dir); setArrow({ dir, id: Math.random() }); };

  return (
    <div
      ref={ref} className="touchpad" role="application" aria-label="Touchpad: deslize para navegar, toque para OK"
      onPointerDown={(e) => {
        if (st.current.id != null) return; // ignore a second finger
        ref.current.setPointerCapture(e.pointerId);
        const [px, py] = pos(e);
        st.current = { id: e.pointerId, sx: px, sy: py, ax: px, ay: py, moved: 0, t: Date.now(), steps: 0, axis: null, last: 0 };
        x.set(px); y.set(py); setTouching(true);
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (e.pointerId !== s.id) return;
        const [px, py] = pos(e); x.set(px); y.set(py);
        s.moved = Math.max(s.moved, Math.hypot(px - s.sx, py - s.sy));
        // lock the gesture to the first clear axis so diagonal jitter doesn't fire extra steps
        if (!s.axis && s.moved > 14) s.axis = Math.abs(px - s.sx) >= Math.abs(py - s.sy) ? 'x' : 'y';
        if (!s.axis) return;
        const d = s.axis === 'x' ? px - s.ax : py - s.ay;
        const now = Date.now();
        if (Math.abs(d) > STEP && now - s.last > 110) {
          fire(s.axis === 'x' ? (d > 0 ? 'right' : 'left') : (d > 0 ? 'down' : 'up'));
          s.steps++; s.last = now; s.ax = px; s.ay = py;
        }
      }}
      onPointerUp={(e) => {
        const s = st.current;
        if (e.pointerId !== s.id) return;
        s.id = null;
        setTouching(false);
        if (s.steps === 0 && s.moved < 10 && Date.now() - s.t < 350) {
          const [px, py] = pos(e); const id = Math.random();
          setRipples((r) => [...r, { id, px, py }]);
          setTimeout(() => setRipples((r) => r.filter((q) => q.id !== id)), 700);
          send('ok');
        }
      }}
      onPointerCancel={() => { st.current.id = null; setTouching(false); }}
    >
      <div className="touchpad-dots" />
      <AnimatePresence>
        {!touching && (
          <motion.div key="hint" className="touchpad-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div>Deslize para navegar</div>
            <div className="label">Toque para confirmar</div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div className="tp-glow" style={{ x, y }} animate={{ opacity: touching ? 1 : 0, scale: touching ? 1 : 0.6 }} transition={soft} />
      <motion.div className="tp-dot" style={{ x, y }} animate={{ opacity: touching ? 1 : 0, scale: touching ? 1 : 0 }} transition={spring} />
      {ripples.map((r) => (
        <motion.div key={r.id} className="tp-ripple" style={{ left: r.px - 40, top: r.py - 40 }}
          initial={{ scale: 0, opacity: 0.6 }} animate={{ scale: 3.2, opacity: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
      ))}
      <AnimatePresence>
        {arrow && (
          <motion.div key={arrow.id} className="tp-arrow" style={ARROW_POS[arrow.dir]}
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: [0, 1, 0], scale: [0.6, 1.15, 1] }} transition={{ duration: 0.45 }}
            onAnimationComplete={() => setArrow(null)}>
            <Ic.chev size={30} w={2.4} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Dpad({ send }) {
  const arcs = [['up', -90, { top: '6%', left: '50%', marginLeft: -43 }], ['down', 90, { bottom: '6%', left: '50%', marginLeft: -43 }],
    ['left', 180, { left: '6%', top: '50%', marginTop: -43 }], ['right', 0, { right: '6%', top: '50%', marginTop: -43 }]];
  return (
    <div className="dpad">
      {arcs.map(([dir, rot, style]) => (
        <motion.button key={dir} className="dpad-arc" style={style} aria-label={LABEL[dir]} onClick={() => send(dir)}
          whileTap={{ scale: 0.9, backgroundColor: 'rgba(61,139,255,.18)' }} transition={spring}>
          <span style={{ transform: `rotate(${rot}deg)`, display: 'grid' }}><Ic.chev size={26} w={2.2} /></span>
        </motion.button>
      ))}
      <motion.button className="dpad-ok" whileTap={{ scale: 0.92 }} transition={spring} onClick={() => send('ok')}>OK</motion.button>
    </div>
  );
}

function Volume({ value, muted }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const [local, setLocal] = useState(value);
  const last = useRef(0);
  useEffect(() => { if (!drag) setLocal(value); }, [value, drag]);

  const apply = (v) => {
    setLocal(v);
    const now = Date.now();
    if (now - last.current > 80) { last.current = now; conn.volume(v); }
  };
  const fromEvent = (e) => { const r = ref.current.getBoundingClientRect(); return Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 100); };

  return (
    <div className="surface volume">
      <motion.button whileTap={tap} onClick={() => conn.cmd('volDown')} aria-label="Diminuir volume" className={'vol-btn' + (muted ? ' danger' : '')}>
        {muted ? <Ic.mute size={20} /> : <Ic.volLow size={20} />}
      </motion.button>
      <div
        ref={ref} className="vol-track" role="slider" tabIndex={0} aria-label="Volume" aria-valuemin={0} aria-valuemax={100} aria-valuenow={local}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') apply(Math.min(100, local + 5)); if (e.key === 'ArrowLeft') apply(Math.max(0, local - 5)); }}
        onPointerDown={(e) => { ref.current.setPointerCapture(e.pointerId); setDrag(true); apply(fromEvent(e)); }}
        onPointerMove={(e) => drag && apply(fromEvent(e))}
        onPointerUp={(e) => { setDrag(false); conn.volume(fromEvent(e)); }}
      >
        <div className="vol-rail" />
        <motion.div className="vol-fill" animate={{ width: local + '%' }} transition={drag ? { duration: 0 } : soft} />
        <motion.div className="vol-knob" animate={{ left: `calc(${local}% - 11px)`, scale: drag ? 1.15 : 1 }} transition={drag ? { duration: 0 } : soft}>
          <AnimatePresence>
            {drag && (
              <motion.div className="vol-tip mono" initial={{ opacity: 0, y: 6, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} style={{ x: '-50%' }}>
                {local}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <motion.button whileTap={tap} onClick={() => conn.cmd('volUp')} aria-label="Aumentar volume" className="vol-btn"><Ic.vol size={20} /></motion.button>
    </div>
  );
}

function Preview() {
  const frame = useFrame();
  const { tvOnline } = useConn();
  const [big, setBig] = useState(false);
  useEffect(() => {
    const sync = () => conn.preview(document.visibilityState === 'visible');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => { document.removeEventListener('visibilitychange', sync); conn.preview(false); };
  }, []);
  return (
    <>
      <motion.button layoutId="tvprev" className="preview" onClick={() => frame && setBig(true)} aria-label="Tela da TV. Toque para ampliar" transition={spring}>
        {frame ? <img src={frame} alt="" draggable={false} /> : <span className="label">{tvOnline ? 'carregando…' : 'TV desligada'}</span>}
        <span className="preview-live"><span className="dot" />AO VIVO</span>
      </motion.button>
      <AnimatePresence>
        {big && (
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBig(false)}>
            <motion.div layoutId="tvprev" className="preview big" transition={spring}>
              {frame && <img src={frame} alt="Tela da TV" draggable={false} />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function RemoteScreen() {
  const { tv } = useConn();
  const [mode, setMode] = useState(() => { try { return Number(localStorage.getItem('controle.mode')) || 0; } catch { return 0; } });
  const [last, setLast] = useState(null);
  const send = useCallback((c) => { conn.cmd(c); setLast({ c, id: Math.random() }); }, []);
  useEffect(() => { try { localStorage.setItem('controle.mode', String(mode)); } catch {} }, [mode]);

  const playing = tv.playing !== false;
  const keys = [['back', 'Voltar', Ic.back], ['home', 'Início', Ic.home], ['play', playing ? 'Pausar' : 'Tocar', playing ? Ic.pause : Ic.play], ['mute', 'Mudo', Ic.mute]];

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}><Segmented id="mode" value={mode} options={['Touchpad', 'Direcional']} onChange={setMode} /></div>
        <div className="last-cmd" aria-live="polite">
          <AnimatePresence mode="popLayout">
            {last && (
              <motion.div key={last.id} className="mono"
                initial={{ y: 18, opacity: 0, filter: 'blur(4px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} exit={{ y: -18, opacity: 0, filter: 'blur(4px)' }} transition={spring}>
                {LABEL[last.c]}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Preview />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={mode} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.18 }}>
          {mode === 0 ? <Touchpad send={send} /> : <Dpad send={send} />}
        </motion.div>
      </AnimatePresence>

      <div className="keys">
        {keys.map(([c, label, Icon]) => (
          <motion.button key={c} className="key" whileTap={tap} transition={spring} aria-label={label} onClick={() => send(c)}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={label} initial={{ scale: 0.5, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0 }} transition={spring} style={{ display: 'grid' }}>
                <Icon />
              </motion.div>
            </AnimatePresence>
            <span>{label}</span>
          </motion.button>
        ))}
      </div>

      <Volume value={tv.volume ?? 30} muted={tv.muted} />
    </div>
  );
}
