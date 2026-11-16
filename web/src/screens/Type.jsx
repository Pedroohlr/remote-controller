import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { conn } from '../conn.js';
import { Ic, spring, tap } from '../ui.jsx';

const RECENT_KEY = 'controle.recent';
const loadRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };

export default function TypeScreen({ notify }) {
  const [text, setText] = useState('');
  const [focus, setFocus] = useState(false);
  const [recent, setRecent] = useState(loadRecent);
  const timer = useRef(null);
  const float = focus || text;

  // Mirror the text on the TV as you type (debounced so we don't flood the TV).
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => conn.text(text), 120);
    return () => clearTimeout(timer.current);
  }, [text]);

  const submit = () => {
    if (!text.trim()) return;
    conn.text(text); conn.cmd('enter');
    const next = [text.trim(), ...recent.filter((r) => r !== text.trim())].slice(0, 6);
    setRecent(next); try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
    notify('Enviado para a TV');
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="surface tv-preview">
        <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.tv size={15} /> Na tela da TV</div>
        <div className="tv-field">
          <span style={{ color: 'var(--dim)', display: 'grid' }}><Ic.search size={16} w={2} /></span>
          <span className={'tv-text' + (text ? '' : ' empty')}>{text || 'Pesquisar'}</span>
          <motion.span className="caret" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} />
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="stack" style={{ gap: 16 }}>
        <label htmlFor="tvtext" className={'field' + (focus ? ' focus' : '')}>
          <motion.span className="field-label" animate={{ y: float ? -12 : 0, scale: float ? 0.8 : 1, color: focus ? '#3D8BFF' : '#A1A1AA' }} transition={spring}>
            Digite aqui
          </motion.span>
          <input id="tvtext" value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            autoComplete="off" autoCorrect="off" enterKeyHint="send" />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <motion.button type="button" whileTap={tap} className="btn btn-flat" onClick={() => setText('')}>Apagar</motion.button>
          <motion.button type="submit" whileTap={tap} className="btn btn-primary">Enviar <Ic.send size={18} /></motion.button>
        </div>
      </form>

      {recent.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 6 }}>Pesquisas recentes</div>
          <div className="chips">
            {recent.map((r, i) => (
              <motion.button key={r} className="chip" whileTap={tap} onClick={() => setText(r)}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.04 * i } }}>
                {r}
              </motion.button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
