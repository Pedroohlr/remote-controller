import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { conn, useConn } from '../conn.js';
import { Ic, Empty, spring, soft, tap } from '../ui.jsx';

function AppIcon({ app, size = 46 }) {
  const c = app.color || '#3A3A40';
  return app.icon
    ? <img src={app.icon} alt="" width={size} height={size} className="app-icon" style={{ width: size, height: size }} />
    : <span className="app-icon" style={{ width: size, height: size, background: `linear-gradient(135deg, ${c}, #111114)` }}>{app.label?.[0] || '?'}</span>;
}

export default function AppsScreen({ notify }) {
  const { tv } = useConn();
  const apps = tv.apps || [];
  const now = tv.now;
  const playing = tv.playing !== false;
  const [pressed, setPressed] = useState(null);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <motion.div layout className="surface now-card">
        <motion.div key={now?.pkg || 'none'} className="now-wash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
          style={{ background: `radial-gradient(120% 120% at 0% 0%, ${(now?.color || '#3D8BFF')}55, transparent 60%)` }} />
        <div className="now-row">
          <motion.div key={(now?.pkg || 'x') + 'i'} initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={spring}>
            {now ? <AppIcon app={now} size={56} /> : <span className="app-icon" style={{ width: 56, height: 56, background: 'var(--s3)' }}><Ic.tv size={24} /></span>}
          </motion.div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="label">Na TV agora</div>
            <div className="now-title">{now?.label || 'Tela inicial'}</div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <motion.button whileTap={tap} className="icon-btn" aria-label="Voltar" onClick={() => conn.cmd('rew')}><Ic.rew size={18} /></motion.button>
            <motion.button whileTap={tap} className="icon-btn solid" aria-label={playing ? 'Pausar' : 'Tocar'} onClick={() => conn.cmd('play')}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={String(playing)} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={spring} style={{ display: 'grid' }}>
                  {playing ? <Ic.pause size={18} /> : <Ic.play size={18} />}
                </motion.div>
              </AnimatePresence>
            </motion.button>
            <motion.button whileTap={tap} className="icon-btn" aria-label="Avançar" onClick={() => conn.cmd('ffwd')}><Ic.ffwd size={18} /></motion.button>
          </div>
        </div>
      </motion.div>

      <div className="section-head"><span>Abrir na TV</span><span className="label">{apps.length ? `${apps.length} apps` : ''}</span></div>

      {apps.length === 0 ? (
        <Empty icon={Ic.grid} title="Nenhum app ainda" text="Os apps aparecem aqui quando a TV estiver ligada e conectada." />
      ) : (
        <motion.div className="app-grid" initial="h" animate="v" variants={{ v: { transition: { staggerChildren: 0.03 } } }}>
          {apps.map((a) => (
            <motion.button key={a.pkg} className={'surface app-tile' + (now?.pkg === a.pkg ? ' active' : '')}
              variants={{ h: { opacity: 0, y: 14, scale: 0.96 }, v: { opacity: 1, y: 0, scale: 1, transition: soft } }}
              whileTap={{ scale: 0.93 }}
              onClick={() => { setPressed(a.pkg); conn.open(a.pkg); notify('Abrindo ' + a.label + ' na TV'); setTimeout(() => setPressed(null), 600); }}>
              <motion.div animate={pressed === a.pkg ? { scale: [1, 1.18, 1] } : {}} transition={{ duration: 0.45 }}><AppIcon app={a} /></motion.div>
              <span className="app-name">{a.label}</span>
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
