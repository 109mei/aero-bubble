import type { GameData } from '../data';
import { components } from './board';
import { neighborTable } from './hex';
import { nextRandom, seedRng } from './rng';
import { cancelTouch, enter, press, release, startRound, step, ticksOf } from './round';
import { createState } from './state';
import type { Board, GameEvent, GameState, RoundResult, RoundState } from './types';

/**
 * バランス調整とテストのためのボット（人の遊び方のまね）。
 * ルール本体と同じコード（press・enter・release・step）で遊ぶ。
 */

/** かたまりの中で、なるべく長い一筆書きの道を探す（budget は探す手間の上限） */
export function longestPath(board: Board, group: number[], budget: number): number[] {
  const nb = neighborTable(board.cols, board.rows);
  const inGroup = new Set(group);
  const degree = (c: number) => nb[c]!.filter((n) => inGroup.has(n)).length;
  let best: number[] = [];
  let steps = 0;
  const path: number[] = [];
  const onPath = new Set<number>();
  const done = () => best.length === group.length || steps >= budget;
  const dfs = (cur: number): void => {
    steps += 1;
    path.push(cur);
    onPath.add(cur);
    if (path.length > best.length) best = path.slice();
    if (!done()) {
      for (const n of nb[cur]!) {
        if (inGroup.has(n) && !onPath.has(n)) {
          dfs(n);
          if (done()) break;
        }
      }
    }
    path.pop();
    onPath.delete(cur);
  };
  // 道の端になりやすい、隣の少ない泡から探す
  const starts = group.slice().sort((a, b) => degree(a) - degree(b) || a - b);
  for (const s of starts) {
    dfs(s);
    if (done()) break;
  }
  return best;
}

/** いちばん長くつなげる道（ヒントとテストに使う） */
export function bestChain(board: Board, minChain: number, budget = 3000): number[] {
  let best: number[] = [];
  for (const g of components(board)) {
    if (g.length < minChain || g.length <= best.length) continue;
    const path = longestPath(board, g, budget);
    if (path.length > best.length) best = path;
  }
  return best.length >= minChain ? best : [];
}

export interface BotProfile {
  name: string;
  /** 考える時間（秒）の平均とばらつき（±） */
  thinkSeconds: number;
  thinkJitter: number;
  /** 泡を1つつなぐのにかかる時間（秒） */
  traceSeconds: number;
  /** いちばん大きいかたまりを選ぶ確率（それ以外は大きさに比例して選ぶ） */
  pickBest: number;
  /** 道を探す手間（大きいほど長い道を見つける） */
  pathBudget: number;
  /** 特別な泡を使う時：すぐ使う・エアロタイムまでとっておく */
  burst: 'asap' | 'fever';
  /** つなぐ長さの上限（対照：長さを考えずに短く消し続ける人） */
  maxLength?: number;
}

export const BOT_PROFILES: Record<'first' | 'casual' | 'normal' | 'expert' | 'spam', BotProfile> = {
  // はじめて遊ぶ人：ゆっくり探し、近くのかたまりを選びがち
  first: { name: 'first', thinkSeconds: 1.5, thinkJitter: 0.6, traceSeconds: 0.2, pickBest: 0.25, pathBudget: 12, burst: 'asap' },
  casual: { name: 'casual', thinkSeconds: 1.1, thinkJitter: 0.4, traceSeconds: 0.16, pickBest: 0.45, pathBudget: 40, burst: 'asap' },
  normal: { name: 'normal', thinkSeconds: 0.75, thinkJitter: 0.3, traceSeconds: 0.13, pickBest: 0.7, pathBudget: 200, burst: 'asap' },
  expert: { name: 'expert', thinkSeconds: 0.5, thinkJitter: 0.2, traceSeconds: 0.11, pickBest: 0.95, pathBudget: 3000, burst: 'fever' },
  // 対照：長いつなぎを探さず、見つけた3つをすぐ消し続ける（手は expert より速い）。これが勝つなら長くつなぐ意味がない
  spam: { name: 'spam', thinkSeconds: 0.3, thinkJitter: 0.1, traceSeconds: 0.1, pickBest: 0, pathBudget: 3, burst: 'asap', maxLength: 3 },
};

type Action = { kind: 'chain'; cells: number[] } | { kind: 'burst'; cell: number };

function pickWeighted(groups: number[][], rng: { rng: number }): number[] {
  const total = groups.reduce((a, g) => a + g.length, 0);
  let x = nextRandom(rng) * total;
  for (const g of groups) {
    x -= g.length;
    if (x < 0) return g;
  }
  return groups[groups.length - 1]!;
}

/** 次の手を決める */
export function decide(r: RoundState, bal: GameData, p: BotProfile, rng: { rng: number }): Action | null {
  const specials: number[] = [];
  r.board.cells.forEach((b, i) => {
    if (b.kind !== 'color') specials.push(i);
  });
  const groups = components(r.board).filter((g) => g.length >= bal.chain.min);
  const useSpecial =
    specials.length > 0 &&
    (p.burst === 'asap' || r.feverLeft > 0 || groups.length === 0 || specials.length >= 3 || r.timeLeft * bal.tickSeconds < 4);
  if (useSpecial) {
    // プリズムを先に使う（まとめて消せる数が多い）
    const prism = specials.find((i) => r.board.cells[i]!.kind === 'prism');
    return { kind: 'burst', cell: prism ?? specials[0]! };
  }
  if (groups.length === 0) return null;
  const biggest = groups.reduce((a, g) => (g.length > a.length ? g : a));
  const group = nextRandom(rng) < p.pickBest ? biggest : pickWeighted(groups, rng);
  const found = longestPath(r.board, group, p.pathBudget);
  const path = p.maxLength !== undefined ? found.slice(0, Math.max(bal.chain.min, p.maxLength)) : found;
  if (path.length < bal.chain.min) return null;
  return { kind: 'chain', cells: path };
}

/** seconds 秒進める。あそびの段階が変わったら止める */
function advance(s: GameState, bal: GameData, seconds: number, onEvents: (ev: GameEvent[]) => void): void {
  const n = ticksOf(bal, seconds);
  const phase = s.round?.phase;
  for (let i = 0; i < n; i++) {
    onEvents(step(s, bal));
    if (s.round === null || s.round.phase !== phase) return;
  }
}

export interface BotRun {
  state: GameState;
  result: RoundResult;
  /** 最初のエアロタイムまでの秒数（あそび始めから。なければ null） */
  firstFever: number | null;
  /** 最初のアクアボム・プリズムができるまでの秒数 */
  firstSpecial: number | null;
  events: number;
  /** つないで消した長さ（消した順） */
  chainLengths: number[];
  /** 点の内訳：つないで消した点・アクアボムとプリズムの点 */
  chainPoints: number;
  burstPoints: number;
  /** エアロタイム中に入った点 */
  feverPoints: number;
}

/** ボットで1回あそぶ。state を渡せば、その記録に足していく */
export function playRound(bal: GameData, seed: number, p: BotProfile, botSeed: number, state?: GameState): BotRun {
  const s = state ?? createState();
  const rng = { rng: seedRng(botSeed ^ 0x2c1b3c6d) };
  const log = {
    firstFever: null as number | null,
    firstSpecial: null as number | null,
    events: 0,
    playStart: 0,
    result: null as RoundResult | null,
    chainLengths: [] as number[],
    chainPoints: 0,
    burstPoints: 0,
    feverPoints: 0,
  };
  const onEvents = (ev: GameEvent[]) => {
    log.events += ev.length;
    for (const e of ev) {
      const r = s.round;
      const t = r ? (r.tick - log.playStart) * bal.tickSeconds : 0;
      if (e.type === 'start' && r) log.playStart = r.tick;
      if (e.type === 'feverStart' && log.firstFever === null) log.firstFever = t;
      if (e.type === 'pop') {
        if (e.made !== null && log.firstSpecial === null) log.firstSpecial = t;
        log.chainLengths.push(e.length);
        log.chainPoints += e.score;
        if (e.fever) log.feverPoints += e.score;
      }
      if (e.type === 'burstScore') {
        log.burstPoints += e.score;
        if (e.fever) log.feverPoints += e.score;
      }
      if (e.type === 'roundEnd') log.result = e.result;
    }
  };
  onEvents(startRound(s, bal, seed));
  let guard = 0;
  while (s.round !== null && guard++ < 100_000) {
    const r = s.round;
    if (r.phase !== 'playing') {
      onEvents(step(s, bal));
      continue;
    }
    const act = decide(r, bal, p, rng);
    const think = Math.max(0.15, p.thinkSeconds + (nextRandom(rng) * 2 - 1) * p.thinkJitter);
    advance(s, bal, think, onEvents);
    if (s.round === null || s.round.phase !== 'playing' || act === null) continue;
    if (act.kind === 'burst') {
      onEvents(press(s, bal, act.cell));
      onEvents(release(s, bal));
      continue;
    }
    onEvents(press(s, bal, act.cells[0]!));
    for (const c of act.cells.slice(1)) onEvents(enter(s, bal, c));
    // なぞっている間も時間は進む（時間切れになったら、すべりこみで消える）
    advance(s, bal, p.traceSeconds * act.cells.length, onEvents);
    if (s.round !== null && s.round.phase === 'playing') {
      if (s.round.chain.length > 0) onEvents(release(s, bal));
      else onEvents(cancelTouch(s));
    }
  }
  if (log.result === null) throw new Error('ボットのあそびが終わらなかった');
  return {
    state: s,
    result: log.result,
    firstFever: log.firstFever,
    firstSpecial: log.firstSpecial,
    events: log.events,
    chainLengths: log.chainLengths,
    chainPoints: log.chainPoints,
    burstPoints: log.burstPoints,
    feverPoints: log.feverPoints,
  };
}
