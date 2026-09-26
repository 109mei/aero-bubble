import { chainScore, multiplier, specialFor, ticksOf, type GameState, type Phase, type SpecialKind } from '../core';
import type { GameData } from '../data';

/** 画面（React）に見せる、あそびの写し */
export interface RoundView {
  phase: Phase;
  score: number;
  /** 残りの秒数（切り上げ） */
  seconds: number;
  /** 残り時間の割合（0〜1） */
  timeFrac: number;
  /** 数え始めの数字（3・2・1）。数え始めでなければ null */
  countdown: number | null;
  combo: number;
  /** コンボが切れるまでの割合（0〜1） */
  comboFrac: number;
  gaugeFrac: number;
  fever: boolean;
  feverFrac: number;
  chainLength: number;
  chainColor: number | null;
  chainLast: number | null;
  /** 今離したら入る点（倍率込み） */
  chainScore: number;
  /** 今離したら生まれる特別な泡 */
  chainMakes: SpecialKind | null;
  /** つなぐのに要る最小の数 */
  minChain: number;
  /** 盤面にある特別な泡の数 */
  specials: number;
}

export interface ViewModel {
  round: RoundView | null;
}

export function buildRoundView(s: GameState, bal: GameData): RoundView | null {
  const r = s.round;
  if (r === null) return null;
  const tps = 1 / bal.tickSeconds;
  const total = ticksOf(bal, bal.round.seconds);
  const cd = ticksOf(bal, bal.round.countdownSeconds);
  const n = r.chain.length;
  const chainColor = n > 0 ? (r.board.cells[r.chain[0]!]?.color ?? null) : null;
  const fever = r.feverLeft > 0;
  const nextCombo = r.comboLeft > 0 ? r.combo + 1 : 1;
  return {
    phase: r.phase,
    score: r.score,
    seconds: Math.ceil(r.timeLeft / tps - 1e-9),
    timeFrac: r.timeLeft / total,
    countdown: r.phase === 'countdown' ? Math.max(1, Math.ceil((cd - r.phaseTicks) / tps - 1e-9)) : null,
    combo: r.combo,
    comboFrac: r.comboLeft / ticksOf(bal, bal.combo.windowSeconds),
    gaugeFrac: fever ? r.feverLeft / ticksOf(bal, bal.fever.seconds) : r.gauge / r.feverNeed,
    fever,
    feverFrac: fever ? r.feverLeft / ticksOf(bal, bal.fever.seconds) : 0,
    chainLength: n,
    chainColor,
    chainLast: n > 0 ? r.chain[n - 1]! : null,
    chainScore: n >= bal.chain.min ? Math.round(chainScore(bal, n) * multiplier(bal, nextCombo, fever)) : 0,
    chainMakes: specialFor(bal, n),
    minChain: bal.chain.min,
    specials: r.board.cells.filter((b) => b.kind !== 'color').length,
  };
}
