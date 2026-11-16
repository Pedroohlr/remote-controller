import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { conn, useConn } from '../conn.js';
import { Ic, Empty, spring, soft, tap } from '../ui.jsx';

function SwipeCard({ item, top, onVote }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const like = useTransform(x, [30, 120], [0, 1]);
  const nope = useTransform(x, [-120, -30], [1, 0]);

  const end = (_, info) => {
    const go = (dir) => { animate(x, dir * 520, { ...soft, velocity: info.velocity.x }); setTimeout(() => onVote(dir > 0), 140); };
    if (info.offset.x > 110 || info.velocity.x > 600) go(1);
    else if (info.offset.x < -110 || info.velocity.x < -600) go(-1);
    else animate(x, 0, spring);
  };

  return (
    <motion.div className="swipe-card" drag={top ? 'x' : false} dragElastic={0.7} onDragEnd={end}
      style={{ x, rotate, zIndex: top ? 2 : 1, cursor: top ? 'grab' : 'default' }}
      initial={{ scale: 0.92, y: 18, opacity: 0 }} animate={{ scale: top ? 1 : 0.94, y: top ? 0 : 16, opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={soft}>
      {item.poster ? <img src={item.poster} alt="" className="swipe-img" draggable={false} /> : <div className="swipe-img" style={{ background: 'var(--s3)' }} />}
      <div className="swipe-shade" />
      <div className="badge mono" style={{ left: 16 }}>★ {Number(item.rating || 0).toFixed(1)}</div>
      <motion.div className="stamp like" style={{ opacity: like }}>CURTI</motion.div>
      <motion.div className="stamp nope" style={{ opacity: nope }}>PASSO</motion.div>
      <div className="swipe-info">
        <div className="label" style={{ color: 'rgba(250,250,250,.7)' }}>{[item.year, item.tv ? 'Série' : 'Filme'].filter(Boolean).join(' · ')}</div>
        <div className="swipe-title">{item.name}</div>
        {item.overview && <div className="swipe-desc">{item.overview}</div>}
      </div>
    </motion.div>
  );
}

export default function MatchScreen({ notify }) {
  const { match, newMatch, tvOnline } = useConn();

  if (!match.active) {
    return <Empty icon={Ic.heart} title="Nenhuma sessão de Match" text={tvOnline ? 'Na TV, abra Descobrir e escolha Match. Os filmes aparecem aqui para vocês votarem.' : 'Ligue a TV para começar um Match.'} />;
  }

  const voted = new Set(match.voted || []);
  const queue = (match.titles || []).filter((t) => !voted.has(t.key));
  const total = match.titles?.length || 0;
  const done = total - queue.length;
  const current = queue[0], next = queue[1];
  const vote = (like) => current && conn.vote(current.key, like);

  return (
    <div className="stack" style={{ gap: 14, height: '100%' }}>
      <div className="match-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mono label">{done}/{total}</span>
          <span className="label">· outra pessoa: {match.otherCount ?? 0}/{total}</span>
        </div>
        <span className="chip mono" style={{ height: 30 }}><Ic.heart size={14} /> {match.matches?.length || 0}</span>
      </div>
      <div className="progress"><motion.div animate={{ width: total ? (done / total) * 100 + '%' : 0 }} transition={soft} /></div>

      <div className="swipe-area">
        {current ? (
          <AnimatePresence>
            {next && <SwipeCard key={next.key} item={next} top={false} onVote={() => {}} />}
            <SwipeCard key={current.key} item={current} top onVote={vote} />
          </AnimatePresence>
        ) : (
          <Empty icon={Ic.heart} title="Você votou em tudo" text={`${match.matches?.length || 0} match(es) até agora. Veja na TV.`} />
        )}
      </div>

      {current && (
        <div className="vote-row">
          <motion.button whileTap={{ scale: 0.85 }} className="vote-btn nope" onClick={() => vote(false)} aria-label="Passar"><Ic.x size={26} w={2.4} /></motion.button>
          <motion.button whileTap={{ scale: 0.85 }} className="vote-btn like" onClick={() => vote(true)} aria-label="Curti"><Ic.heart size={26} w={2.2} /></motion.button>
        </div>
      )}

      <AnimatePresence>
        {newMatch && (
          <motion.div key="pop" className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={conn.clearMatchPopup}>
            <motion.div className="match-pop" onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.6, y: 40, rotate: -6 }} animate={{ scale: 1, y: 0, rotate: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}>
              <div className="pop-posters">
                {[-1, 1].map((s) => (
                  <motion.img key={s} src={newMatch.poster} alt="" className="pop-poster"
                    initial={{ x: s * 80, rotate: s * 20, opacity: 0 }} animate={{ x: s * 34, rotate: s * 8, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }} />
                ))}
                <motion.div className="pop-heart" initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ delay: 0.35, duration: 0.5 }}>
                  <Ic.heart size={24} w={2.4} />
                </motion.div>
              </div>
              <div className="pop-title">Deu match</div>
              <div className="pop-text">Vocês dois curtiram <b>{newMatch.name}</b></div>
              <motion.button whileTap={tap} className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={() => { conn.clearMatchPopup(); notify('O título está aberto na TV'); }}>Ver na TV</motion.button>
              <motion.button whileTap={tap} className="btn btn-flat" style={{ width: '100%', marginTop: 8 }} onClick={conn.clearMatchPopup}>Continuar votando</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
