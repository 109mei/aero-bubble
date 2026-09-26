import type { GameData } from '../data';
import { collapse, fillBoard, hasMove, shuffleBoard } from './board';
import { hexDistance, isNeighbor } from './hex';
import { applyResult } from './progress';
import { seedRng } from './rng';
import type { Bubble, GameEvent, GameState, PopCell, RoundState, RoundStats, SpecialKind } from './types';

/** 秒を刻みの数にする */
export function ticksOf(bal: GameData, seconds: number): number {
  return Math.max(1, Math.round(seconds / bal.tickSeconds));
}

/** 1秒あたりの刻みの数 */
export function ticksPerSecond(bal: GameData): number {
  return Math.round(1 / bal.tickSeconds);
}

export function emptyStats(): RoundStats {
  return { chains: 0, popped: 0, maxChain: 0, maxCombo: 0, fevers: 0, bombsMade: 0, prismsMade: 0, bursts: 0, shuffles: 0 };
}

/** つないだ長さ n の点（コンボとエアロタイムの倍率をかける前） */
export function chainScore(bal: GameData, n: number): number {
  const k = Math.max(0, n - bal.chain.min);
  return bal.score.perBubble * n + (bal.score.lengthStep * k * (k + 1)) / 2;
}

/** コンボとエアロタイムの倍率 */
export function multiplier(bal: GameData, combo: number, fever: boolean): number {
  const c = Math.min(Math.max(combo - 1, 0), bal.combo.cap);
  return (1 + c * bal.combo.step) * (fever ? bal.fever.multiplier : 1);
}

/** つないだ長さから生まれる特別な泡 */
export function specialFor(bal: GameData, n: number): SpecialKind | null {
  if (n >= bal.specials.prismAt) return 'prism';
  if (n >= bal.specials.bombAt) return 'bomb';
  return null;
}

export function createRound(bal: GameData, seed: number): RoundState {
  const r: RoundState = {
    seed: seed >>> 0,
    rng: seedRng(seed),
    tick: 0,
    phase: 'countdown',
    phaseTicks: 0,
    timeLeft: ticksOf(bal, bal.round.seconds),
    board: { cols: bal.board.cols, rows: bal.board.rows, cells: [] },
    nextId: 1,
    chain: [],
    pressed: null,
    score: 0,
    combo: 0,
    comboLeft: 0,
    gauge: 0,
    feverNeed: bal.fever.need,
    feverLeft: 0,
    burstQueue: [],
    lastBurstAt: 0,
    stats: emptyStats(),
  };
  r.board = fillBoard(r, bal.board.cols, bal.board.rows, bal.board.colors);
  if (!hasMove(r.board, bal.chain.min)) shuffleBoard(r, bal.chain.min);
  return r;
}

// ------------------------------------------------------------ 命令

/** 新しくあそび始める（数え始めから） */
export function startRound(s: GameState, bal: GameData, seed: number): GameEvent[] {
  s.round = createRound(bal, seed);
  s.lastResult = null;
  return [{ type: 'countdown', n: bal.round.countdownSeconds }];
}

/** あそびをやめる（記録には何も足さない） */
export function abandonRound(s: GameState): void {
  s.round = null;
}

function validCell(r: RoundState, cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < r.board.cells.length;
}

/** 泡に指を置く。ふつうの泡ならつなぎ始め、特別な泡なら離したときにはじける */
export function press(s: GameState, _bal: GameData, cell: number): GameEvent[] {
  const r = s.round;
  if (r === null || r.phase !== 'playing' || !validCell(r, cell)) return [];
  if (r.chain.length > 0 || r.pressed !== null) return [];
  const b = r.board.cells[cell]!;
  if (b.kind === 'color') {
    r.chain = [cell];
    return [{ type: 'link', cell, length: 1, color: b.color }];
  }
  r.pressed = cell;
  return [];
}

/** 指が泡の上に入った。隣の同じ色ならつなぎ、1つ前の泡に戻ったら最後の1つを外す */
export function enter(s: GameState, _bal: GameData, cell: number): GameEvent[] {
  const r = s.round;
  if (r === null || r.phase !== 'playing' || !validCell(r, cell)) return [];
  if (r.pressed !== null) {
    if (cell !== r.pressed) r.pressed = null;
    return [];
  }
  const n = r.chain.length;
  if (n === 0) return [];
  const last = r.chain[n - 1]!;
  if (cell === last) return [];
  if (n >= 2 && cell === r.chain[n - 2]) {
    r.chain.pop();
    return [{ type: 'unlink', cell: last, length: n - 1 }];
  }
  if (r.chain.includes(cell)) return [];
  const { cols, rows, cells } = r.board;
  if (!isNeighbor(last, cell, cols, rows)) return [];
  const b = cells[cell]!;
  const color = cells[r.chain[0]!]!.color;
  if (b.kind !== 'color' || b.color !== color) return [];
  r.chain.push(cell);
  return [{ type: 'link', cell, length: n + 1, color }];
}

/** 指を離す。つなぎが足りていれば消し、特別な泡を押していたらはじけさせる */
export function release(s: GameState, bal: GameData): GameEvent[] {
  const r = s.round;
  if (r === null || r.phase !== 'playing') return [];
  const ev: GameEvent[] = [];
  if (r.pressed !== null) {
    const cell = r.pressed;
    r.pressed = null;
    detonate(r, bal, cell, false, ev);
  } else if (r.chain.length >= bal.chain.min) {
    popChain(r, bal, ev);
  } else if (r.chain.length > 0) {
    ev.push({ type: 'cancel', cells: r.chain.slice() });
    r.chain = [];
  }
  return ev;
}

/** 指の操作が取り消された（ほかの指・画面の外・一時停止） */
export function cancelTouch(s: GameState): GameEvent[] {
  const r = s.round;
  if (r === null) return [];
  r.pressed = null;
  if (r.chain.length === 0) return [];
  const cells = r.chain.slice();
  r.chain = [];
  return [{ type: 'cancel', cells }];
}

// ------------------------------------------------------------ 進行

/** 1刻み進める */
export function step(s: GameState, bal: GameData): GameEvent[] {
  const r = s.round;
  if (r === null || r.phase === 'ended') return [];
  const ev: GameEvent[] = [];
  r.tick += 1;
  r.phaseTicks += 1;
  if (r.phase === 'countdown') {
    const tps = ticksPerSecond(bal);
    if (r.phaseTicks >= ticksOf(bal, bal.round.countdownSeconds)) {
      r.phase = 'playing';
      r.phaseTicks = 0;
      ev.push({ type: 'start' });
    } else if (r.phaseTicks % tps === 0) {
      ev.push({ type: 'countdown', n: bal.round.countdownSeconds - r.phaseTicks / tps });
    }
  } else if (r.phase === 'playing') {
    stepPlaying(r, bal, ev);
  } else {
    stepLastBurst(s, r, bal, ev);
  }
  return ev;
}

function stepPlaying(r: RoundState, bal: GameData, ev: GameEvent[]): void {
  if (r.comboLeft > 0) {
    r.comboLeft -= 1;
    if (r.comboLeft === 0 && r.combo > 0) {
      ev.push({ type: 'comboEnd', combo: r.combo });
      r.combo = 0;
    }
  }
  if (r.feverLeft > 0) {
    // エアロタイムの間は時間が止まる
    r.feverLeft -= 1;
    if (r.feverLeft === 0) ev.push({ type: 'feverEnd' });
    return;
  }
  r.timeLeft -= 1;
  const tps = ticksPerSecond(bal);
  if (r.timeLeft > 0 && r.timeLeft % tps === 0 && r.timeLeft / tps <= bal.round.warnSeconds) {
    ev.push({ type: 'warn', seconds: r.timeLeft / tps });
  }
  if (r.timeLeft <= 0) timeUp(r, bal, ev);
}

/** 時間切れ。つないでいる途中なら、それも消す（すべりこみ）。残った特別な泡は1つずつ自動ではじける */
function timeUp(r: RoundState, bal: GameData, ev: GameEvent[]): void {
  r.timeLeft = 0;
  const slideIn = r.chain.length >= bal.chain.min;
  ev.push({ type: 'timeUp', slideIn });
  if (slideIn) popChain(r, bal, ev);
  else if (r.chain.length > 0) ev.push({ type: 'cancel', cells: r.chain.slice() });
  r.chain = [];
  r.pressed = null;
  r.phase = 'lastBurst';
  r.phaseTicks = 0;
  r.lastBurstAt = 0;
  r.burstQueue = r.board.cells.filter((b) => b.kind !== 'color').map((b) => b.id);
}

function stepLastBurst(s: GameState, r: RoundState, bal: GameData, ev: GameEvent[]): void {
  if (r.burstQueue.length > 0) {
    if (r.phaseTicks - r.lastBurstAt < ticksOf(bal, bal.round.lastBurstIntervalSeconds)) return;
    while (r.burstQueue.length > 0) {
      const id = r.burstQueue.shift()!;
      const cell = r.board.cells.findIndex((b) => b.id === id);
      // ほかの泡に巻き込まれて、もうはじけていることがある
      if (cell < 0) continue;
      detonate(r, bal, cell, true, ev);
      r.lastBurstAt = r.phaseTicks;
      return;
    }
  }
  if (r.phaseTicks - r.lastBurstAt >= ticksOf(bal, bal.round.endDelaySeconds)) {
    r.phase = 'ended';
    const result = applyResult(s.progress, r, bal);
    s.lastResult = result;
    s.round = null;
    ev.push({ type: 'roundEnd', result });
  }
}

// ------------------------------------------------------------ 消す

function bumpCombo(r: RoundState, bal: GameData): number {
  r.combo = r.comboLeft > 0 ? r.combo + 1 : 1;
  r.comboLeft = ticksOf(bal, bal.combo.windowSeconds);
  r.stats.maxCombo = Math.max(r.stats.maxCombo, r.combo);
  return r.combo;
}

function popChain(r: RoundState, bal: GameData, ev: GameEvent[]): void {
  const chain = r.chain;
  r.chain = [];
  const n = chain.length;
  const { cells } = r.board;
  const color = cells[chain[0]!]!.color;
  const popped: PopCell[] = chain.map((cell) => {
    const b = cells[cell]!;
    return { id: b.id, cell, color: b.color, kind: b.kind };
  });
  const combo = bumpCombo(r, bal);
  const fever = r.feverLeft > 0;
  const score = Math.round(chainScore(bal, n) * multiplier(bal, combo, fever));
  r.score += score;
  r.stats.chains += 1;
  r.stats.popped += n;
  r.stats.maxChain = Math.max(r.stats.maxChain, n);

  // 長くつないだら、最後の泡の場所に特別な泡が生まれる
  const made = specialFor(bal, n);
  const keep = new Map<number, Bubble>();
  let madeId: number | null = null;
  if (made !== null) {
    const special: Bubble = { id: r.nextId++, kind: made, color };
    keep.set(chain[n - 1]!, special);
    madeId = special.id;
    if (made === 'bomb') r.stats.bombsMade += 1;
    else r.stats.prismsMade += 1;
  }
  collapse(r, new Set(chain), keep, bal.board.colors);
  ev.push({ type: 'pop', cells: popped, length: n, color, score, combo, fever, made, madeId });
  addGauge(r, bal, n, ev);
  ensureMove(r, bal, ev);
}

/**
 * 特別な泡をはじけさせる。アクアボムはまわりの泡を、プリズムは同じ色の泡をすべて消す。
 * 範囲に入ったほかの特別な泡も、続けてはじける（連鎖）。
 */
function detonate(r: RoundState, bal: GameData, cell: number, auto: boolean, ev: GameEvent[]): void {
  const { cells, rows } = r.board;
  if (cells[cell]!.kind === 'color') return;
  const removed = new Set<number>([cell]);
  const order: number[] = [cell];
  const bursts: { cell: number; bubble: Bubble; hit: PopCell[] }[] = [];
  for (let q = 0; q < order.length; q++) {
    const sc = order[q]!;
    const sb = cells[sc]!;
    const hit: PopCell[] = [{ id: sb.id, cell: sc, color: sb.color, kind: sb.kind }];
    for (let i = 0; i < cells.length; i++) {
      if (removed.has(i)) continue;
      const b = cells[i]!;
      const inRange =
        sb.kind === 'bomb' ? hexDistance(sc, i, rows) <= bal.specials.bombRadius : b.kind === 'color' && b.color === sb.color;
      if (!inRange) continue;
      removed.add(i);
      if (b.kind === 'color') hit.push({ id: b.id, cell: i, color: b.color, kind: 'color' });
      else order.push(i);
    }
    bursts.push({ cell: sc, bubble: sb, hit });
  }
  const count = removed.size;
  const combo = auto ? 1 : bumpCombo(r, bal);
  const fever = !auto && r.feverLeft > 0;
  const bonus = bursts.reduce((a, b) => a + (b.bubble.kind === 'bomb' ? bal.score.bombBonus : bal.score.prismBonus), 0);
  const score = Math.round((count * bal.score.burstPerBubble + bonus) * multiplier(bal, combo, fever));
  r.score += score;
  r.stats.popped += count;
  r.stats.bursts += bursts.length;
  bursts.forEach((b, k) =>
    ev.push({
      type: 'burst',
      kind: b.bubble.kind as SpecialKind,
      id: b.bubble.id,
      cell: b.cell,
      color: b.bubble.color,
      cells: b.hit,
      chained: k > 0,
      auto,
    }),
  );
  ev.push({ type: 'burstScore', score, count, combo, fever, auto, cell });
  collapse(r, removed, new Map(), bal.board.colors);
  if (!auto) addGauge(r, bal, count, ev);
  ensureMove(r, bal, ev);
}

/** エアロゲージをためる。いっぱいになったらエアロタイム（時間が止まり、点が倍になる） */
function addGauge(r: RoundState, bal: GameData, count: number, ev: GameEvent[]): void {
  if (r.feverLeft > 0) return;
  r.gauge = Math.min(r.feverNeed, r.gauge + count);
  if (r.gauge < r.feverNeed || r.phase !== 'playing' || r.timeLeft <= 0) return;
  r.gauge = 0;
  r.feverLeft = ticksOf(bal, bal.fever.seconds);
  r.feverNeed = Math.min(bal.fever.needMax, r.feverNeed + bal.fever.needGrowth);
  r.stats.fevers += 1;
  ev.push({ type: 'feverStart', seconds: bal.fever.seconds });
}

/** 消せる手がなくなったら並べ直す */
function ensureMove(r: RoundState, bal: GameData, ev: GameEvent[]): void {
  if (r.phase !== 'playing' || hasMove(r.board, bal.chain.min)) return;
  shuffleBoard(r, bal.chain.min);
  r.stats.shuffles += 1;
  ev.push({ type: 'shuffle' });
}
