import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { conn } from '../conn.js';
import { Ic, spring, tap } from '../ui.jsx';

export function PairForm({ onDone, autoFocus = true }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 350); }, [autoFocus]);

  const submit = async (c = code) => {
    if (c.length !== 6 || busy) return;
    setBusy(true); setError('');
    try { await conn.pair(c); onDone?.(); }
    catch (e) { setError(e.message); setShake((s) => s + 1); setCode(''); ref.current?.focus(); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <motion.label htmlFor="paircode" className="code-row" key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}>
        {Array.from({ length: 6 }, (_, k) => (
          <motion.div key={k} className={'code-cell' + (code.length === k ? ' cur' : '') + (error ? ' err' : '')} animate={{ scale: code.length === k ? 1.04 : 1 }} transition={spring}>
            <AnimatePresence mode="popLayout">
              {code[k] && <motion.span key={code[k] + k} className="mono" initial={{ y: 14, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={spring}>{code[k]}</motion.span>}
            </AnimatePresence>
          </motion.div>
        ))}
        <input id="paircode" ref={ref} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} aria-label="Código de 6 dígitos"
          onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); setError(''); if (v.length === 6) submit(v); }} />
      </motion.label>
      <AnimatePresence>
        {error && <motion.div className="form-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{error}</motion.div>}
      </AnimatePresence>
      <motion.button type="submit" whileTap={code.length === 6 ? tap : {}} disabled={code.length !== 6 || busy}
        className={'btn ' + (code.length === 6 ? 'btn-primary' : 'btn-flat')} style={{ width: '100%', marginTop: 20, opacity: code.length === 6 ? 1 : 0.5 }}>
        {busy ? <motion.span className="spinner" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} /> : 'Conectar'}
      </motion.button>
    </form>
  );
}

const Steps = () => (
  <p className="pair-text">Na TV, aperte o botão do <b>timer</b> no canto de cima e escolha <b>Parear celular</b>. Digite o código que aparecer.</p>
);

export function PairScreen() {
  return (
    <motion.div className="pair-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pair-orb">
        <motion.div className="orbit" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 14, ease: 'linear' }} />
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring, delay: 0.1 }}><Ic.tv size={40} w={1.5} /></motion.div>
      </div>
      <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>Conectar à TV</motion.h1>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}><Steps /></motion.div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ width: '100%', marginTop: 28 }}>
        <PairForm />
      </motion.div>
    </motion.div>
  );
}

export function PairSheet({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="scrim plain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div key="sheet" role="dialog" aria-label="Trocar TV" className="sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => { if (i.offset.y > 120 || i.velocity.y > 500) onClose(); }}>
            <div className="grabber" />
            <div className="sheet-title">Trocar de TV</div>
            <Steps />
            <div style={{ marginTop: 22 }}><PairForm onDone={onClose} /></div>
            <motion.button whileTap={tap} className="btn btn-ghost-danger" style={{ width: '100%', marginTop: 10 }} onClick={() => { conn.forget(); onClose(); }}>Desconectar este celular</motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
