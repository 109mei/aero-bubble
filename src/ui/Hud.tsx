import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { pauseGame, useGame } from '../store/game';
import { cellCenter } from '../world/layout';
import { num } from './format';
import { Pause, Sparkles, Zap } from './icons';

/** 数字をなめらかに増やして見せる（React を毎フレーム描き直さず、文字だけ書き換える） */
export function CountUp({ value, className, testId, duration = 0.45 }: { value: number; className?: string; testId?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  useEffect(() => {
    const from = shown.current;
    const to = value;
    if (from === to) return;
    const reduced = document.documentElement.dataset.motion === 'reduce';
    if (reduced) {
      shown.current = to;
      if (ref.current) ref.current.textContent = num(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / (duration * 1000));
      const e = 1 - Math.pow(1 - k, 3);
      const v = Math.round(from + (to - from) * e);
      shown.current = v;
      if (ref.current) ref.current.textContent = num(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      shown.current = to;
      if (ref.current) ref.current.textContent = num(to);
    };
  }, [value, duration]);
  return (
    <span ref={ref} className={className} data-testid={testId} data-value={value}>
      {num(shown.current)}
    </span>
  );
}

function TimerRing() {
  const v = useGame(useShallow((st) => ({ seconds: st.round?.seconds ?? 0, frac: st.round?.timeFrac ?? 0, fever: st.round?.fever ?? false, phase: st.round?.phase })));
  const R = 27;
  const C = 2 * Math.PI * R;
  const warn = v.phase === 'playing' && v.seconds <= 10 && !v.fever;
  return (
    <div className={`timer${warn ? ' warn' : ''}${v.fever ? ' frozen' : ''}`} role="timer" aria-label={`のこり${v.seconds}秒`}>
      <svg viewBox="0 0 68 68" aria-hidden="true">
        <circle className="timer-track" cx="34" cy="34" r={R} />
        <circle className="timer-fill" cx="34" cy="34" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, v.frac)))} />
      </svg>
      <span className="timer-num" data-testid="time" data-value={v.seconds}>
        {v.seconds}
      </span>
    </div>
  );
}

function ScoreBox() {
  const v = useGame(useShallow((st) => ({ score: st.round?.score ?? 0, combo: st.round?.combo ?? 0, comboFrac: st.round?.comboFrac ?? 0 })));
  return (
    <div className="score-box">
      <span className="score-label">スコア</span>
      <CountUp value={v.score} className="score-num" testId="score" duration={0.35} />
      <div className={`combo${v.combo >= 2 ? ' on' : ''}`} aria-live="off" data-testid="combo" data-value={v.combo}>
        <span className="combo-num">{v.combo}</span>
        <span className="combo-label">コンボ</span>
        <span className="combo-bar" style={{ transform: `scaleX(${Math.max(0, Math.min(1, v.comboFrac))})` }} />
      </div>
    </div>
  );
}

function Gauge() {
  const L = useGame((st) => st.layout);
  const v = useGame(useShallow((st) => ({ frac: st.round?.gaugeFrac ?? 0, fever: st.round?.fever ?? false })));
  const pct = Math.round(Math.max(0, Math.min(1, v.frac)) * 100);
  return (
    <div
      className={`gauge${v.fever ? ' fever' : ''}`}
      style={{ left: L.gauge.x, top: L.gauge.y, width: L.gauge.w, height: L.gauge.h }}
      role="progressbar"
      aria-label={v.fever ? 'エアロタイムののこり' : 'エアロゲージ'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      data-testid="gauge"
      data-fever={v.fever}
    >
      <span className="gauge-fill" style={{ transform: `scaleX(${pct / 100})` }} />
      <span className="gauge-shine" />
      <span className="gauge-label">
        {v.fever ? <Sparkles size={15} strokeWidth={2.4} aria-hidden="true" /> : <Zap size={14} strokeWidth={2.6} aria-hidden="true" />}
        {v.fever ? 'エアロタイム 点が2倍' : 'エアロゲージ'}
      </span>
    </div>
  );
}

/** つないでいる数と、今離したら入る点（最後の泡の上に出す） */
function ChainBadge() {
  const L = useGame((st) => st.layout);
  const v = useGame(
    useShallow((st) => ({
      n: st.round?.chainLength ?? 0,
      last: st.round?.chainLast ?? null,
      score: st.round?.chainScore ?? 0,
      makes: st.round?.chainMakes ?? null,
      min: st.round?.minChain ?? 3,
      color: st.round?.chainColor ?? 0,
    })),
  );
  if (v.n === 0 || v.last === null) return null;
  const at = cellCenter(L.board, v.last);
  const r = L.board.r;
  const above = at.y - r * 2.35 > L.panel.y;
  const enough = v.n >= v.min;
  return (
    <div
      className={`chain-badge c${v.color}${enough ? ' ok' : ''}${v.makes ? ` makes-${v.makes}` : ''}`}
      style={{ left: at.x, top: above ? at.y - r * 1.45 : at.y + r * 1.45 }}
      data-testid="chain-badge"
      data-count={v.n}
      aria-hidden="true"
    >
      <b>{v.n}</b>
      {enough && <small>+{num(v.score)}</small>}
      {v.makes === 'bomb' && <em>ボム</em>}
      {v.makes === 'prism' && <em>プリズム</em>}
    </div>
  );
}

export function Hud() {
  const L = useGame((st) => st.layout);
  return (
    <>
      <div className="hud" style={{ left: L.hud.x, top: L.hud.y, width: L.hud.w, height: L.hud.h }}>
        <TimerRing />
        <ScoreBox />
        <button className="orb-btn small pause-btn" aria-label="一時停止" data-testid="pause" onClick={() => pauseGame()}>
          <Pause size={24} strokeWidth={2.6} aria-hidden="true" />
        </button>
      </div>
      <Gauge />
      <ChainBadge />
    </>
  );
}
