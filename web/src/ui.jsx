import { motion, AnimatePresence } from 'framer-motion';

export const spring = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 };
export const soft = { type: 'spring', stiffness: 260, damping: 28 };
export const tap = { scale: 0.94 };

const svg = (children) => function Icon({ size = 22, w = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
};

export const Ic = {
  power: svg(<><path d="M12 3v8" /><path d="M6.4 6.6a8 8 0 1 0 11.2 0" /></>),
  back: svg(<><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>),
  home: svg(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9" /></>),
  play: svg(<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />),
  pause: svg(<><rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none" /><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none" /></>),
  mute: svg(<><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></>),
  vol: svg(<><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>),
  volLow: svg(<><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></>),
  remote: svg(<><rect x="7" y="2.5" width="10" height="19" rx="5" /><circle cx="12" cy="8" r="2" /><path d="M12 14v.01M12 17.5v.01" /></>),
  grid: svg(<><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>),
  keys: svg(<><rect x="2.5" y="6" width="19" height="12" rx="3" /><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8" /></>),
  heart: svg(<path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z" />),
  x: svg(<path d="M18 6 6 18M6 6l12 12" />),
  chev: svg(<path d="m9 6 6 6-6 6" />),
  rew: svg(<><path d="M11 6 4 12l7 6z" fill="currentColor" stroke="none" /><path d="M20 6l-7 6 7 6z" fill="currentColor" stroke="none" /></>),
  ffwd: svg(<><path d="M13 6l7 6-7 6z" fill="currentColor" stroke="none" /><path d="M4 6l7 6-7 6z" fill="currentColor" stroke="none" /></>),
  send: svg(<path d="M5 12h14M13 6l6 6-6 6" />),
  tv: svg(<><rect x="3" y="4.5" width="18" height="12" rx="2.5" /><path d="M8.5 20h7" /></>),
  search: svg(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
};

export function Toast({ toast }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id} role="status" className="toast glass"
          initial={{ y: -40, opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
          animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ y: -30, opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
          transition={spring}
          style={{ x: '-50%' }}
        >
          <span className={'dot ' + (toast.kind === 'error' ? 'dot-danger' : 'dot-primary')} />
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Segmented({ value, options, onChange, id }) {
  return (
    <div className="surface segmented" style={{ gridTemplateColumns: `repeat(${options.length},1fr)` }}>
      {options.map((o, i) => (
        <button key={o} onClick={() => onChange(i)} className={value === i ? 'on' : ''}>
          {value === i && <motion.span layoutId={'seg-' + id} transition={spring} className="seg-pill" />}
          <span style={{ position: 'relative' }}>{o}</span>
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, title, text }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={soft} className="empty">
      <div className="empty-icon"><Icon size={26} /></div>
      <div className="empty-title">{title}</div>
      <div className="empty-text">{text}</div>
    </motion.div>
  );
}
