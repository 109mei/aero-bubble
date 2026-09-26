import { describe, expect, it } from 'vitest';
import {
  cancelTouch,
  chainScore,
  createState,
  enter,
  hexDistance,
  multiplier,
  press,
  release,
  startRound,
  step,
  ticksOf,
  type GameEvent,
  type GameState,
} from '../src/core';
import { bal, boardText, cell, playing, run, setBoard } from './helpers';

/** c0 の上の3つが色0（ほかは同じ色が隣り合わない）。c6 の上に色2のかたまりを残し、消したあとも手がなくならないようにする */
const THREE = ['00034012', '23401234', '40123401', '12340123', '34012340', '01234012', '22234012'];

function link(s: GameState, cells: number[]): GameEvent[] {
  const ev = press(s, bal, cells[0]!);
  for (const c of cells.slice(1)) ev.push(...enter(s, bal, c));
  return ev;
}

describe('数え始め', () => {
  it('3・2・1 のあとにあそべるようになり、それまでは泡に触れない', () => {
    const s = createState();
    expect(startRound(s, bal, 1)).toEqual([{ type: 'countdown', n: 3 }]);
    expect(press(s, bal, 0)).toEqual([]);
    expect(s.round!.chain).toEqual([]);
    const ev = run(s, bal.round.countdownSeconds);
    expect(ev.filter((e) => e.type === 'countdown').map((e) => (e as { n: number }).n)).toEqual([2, 1]);
    expect(ev.at(-1)).toEqual({ type: 'start' });
    expect(s.round!.phase).toBe('playing');
    expect(s.round!.timeLeft).toBe(ticksOf(bal, bal.round.seconds));
  });
});

describe('つなぐ', () => {
  it('隣の同じ色だけをつなぎ、1つ前に戻ると最後の1つが外れる', () => {
    const s = playing();
    setBoard(s, THREE);
    expect(press(s, bal, cell(0, 0))).toEqual([{ type: 'link', cell: cell(0, 0), length: 1, color: 0 }]);
    enter(s, bal, cell(0, 1));
    enter(s, bal, cell(0, 2));
    expect(s.round!.chain).toEqual([cell(0, 0), cell(0, 1), cell(0, 2)]);
    // 1つ前に戻る
    expect(enter(s, bal, cell(0, 1))).toEqual([{ type: 'unlink', cell: cell(0, 2), length: 2 }]);
    expect(s.round!.chain).toEqual([cell(0, 0), cell(0, 1)]);
    enter(s, bal, cell(0, 2));
    // 違う色・つないだ泡・離れた同じ色は、つながらない
    expect(enter(s, bal, cell(1, 1))).toEqual([]);
    expect(enter(s, bal, cell(0, 0))).toEqual([]);
    expect(enter(s, bal, cell(0, 5))).toEqual([]);
    expect(s.round!.chain).toEqual([cell(0, 0), cell(0, 1), cell(0, 2)]);
  });

  it('奇数の列は半マス下にずれていて、斜めの隣もつなげる', () => {
    const s = playing();
    // c1 は奇数の列：c1 の行0 は c0 の行0・行1 と c2 の行0・行1 の隣
    setBoard(s, ['03412340', '00401234', '40123401', '12340123', '34012340', '01234012', '22234012']);
    link(s, [cell(0, 0), cell(1, 0), cell(2, 1)]);
    expect(s.round!.chain).toEqual([cell(0, 0), cell(1, 0), cell(2, 1)]);
    enter(s, bal, cell(1, 1));
    expect(s.round!.chain).toHaveLength(4);
  });

  it('3つに足りずに離すと取り消しになり、盤面は変わらない', () => {
    const s = playing();
    setBoard(s, THREE);
    link(s, [cell(0, 0), cell(0, 1)]);
    expect(release(s, bal)).toEqual([{ type: 'cancel', cells: [cell(0, 0), cell(0, 1)] }]);
    expect(boardText(s)).toEqual(THREE);
    expect(s.round!.score).toBe(0);
  });

  it('指の操作が取り消されたら、つないだ泡は外れる', () => {
    const s = playing();
    setBoard(s, THREE);
    link(s, [cell(0, 0), cell(0, 1), cell(0, 2)]);
    expect(cancelTouch(s)).toEqual([{ type: 'cancel', cells: [cell(0, 0), cell(0, 1), cell(0, 2)] }]);
    expect(release(s, bal)).toEqual([]);
    expect(boardText(s)).toEqual(THREE);
  });

  it('盤面の外の番号は受け付けない', () => {
    const s = playing();
    expect(press(s, bal, -1)).toEqual([]);
    expect(press(s, bal, 999)).toEqual([]);
    expect(press(s, bal, 1.5)).toEqual([]);
  });
});

describe('消す', () => {
  it('3つ消すと、残りは上へ詰まり、下から新しい泡が湧く', () => {
    const s = playing();
    setBoard(s, THREE);
    link(s, [cell(0, 0), cell(0, 1), cell(0, 2)]);
    const ev = release(s, bal);
    const pop = ev.find((e) => e.type === 'pop')!;
    expect(pop).toMatchObject({ type: 'pop', length: 3, color: 0, combo: 1, fever: false, made: null, score: 300 });
    const after = boardText(s);
    expect(after[0]!.slice(0, 5)).toBe('34012');
    expect(after.slice(1)).toEqual(THREE.slice(1));
    expect(s.round!.score).toBe(300);
    expect(s.round!.stats).toMatchObject({ chains: 1, popped: 3, maxChain: 3 });
  });

  it('つなぎの点は長いほど大きく上乗せされる', () => {
    expect(chainScore(bal, 3)).toBe(300);
    expect(chainScore(bal, 4)).toBe(500);
    expect(chainScore(bal, 7)).toBe(1700);
    expect(chainScore(bal, 11)).toBe(4700);
  });

  it('7つつなぐと、最後の泡の場所にアクアボムが生まれる', () => {
    const s = playing();
    setBoard(s, ['00000003', '23401234', '40123401', '12340123', '34012340', '01234012', '22234012']);
    link(s, [0, 1, 2, 3, 4, 5, 6].map((row) => cell(0, row)));
    const ev = release(s, bal);
    const pop = ev.find((e) => e.type === 'pop') as Extract<GameEvent, { type: 'pop' }>;
    expect(pop.made).toBe('bomb');
    // 最後の泡（行6）の場所に生まれ、上に詰まって行0へ
    const b = s.round!.board.cells[cell(0, 0)]!;
    expect(b).toMatchObject({ kind: 'bomb', id: pop.madeId });
    expect(s.round!.stats.bombsMade).toBe(1);
  });

  it('11つなぐとプリズムが生まれ、つないだ色を覚えている', () => {
    const s = playing();
    setBoard(s, ['00000000', '00023401', '40123401', '12340123', '34012340', '01234012', '22234012']);
    const path = [cell(1, 2), cell(1, 1), cell(1, 0), ...[0, 1, 2, 3, 4, 5, 6, 7].map((row) => cell(0, row))];
    link(s, path);
    expect(s.round!.chain).toHaveLength(11);
    const ev = release(s, bal);
    expect(ev.find((e) => e.type === 'pop')).toMatchObject({ made: 'prism', length: 11 });
    expect(s.round!.board.cells[cell(0, 0)]).toMatchObject({ kind: 'prism', color: 0 });
    expect(s.round!.stats.prismsMade).toBe(1);
  });
});

describe('アクアボムとプリズム', () => {
  it('アクアボムはタップで距離2までの泡を消し、範囲のほかのボムも続けてはじける', () => {
    const s = playing();
    const cols = ['01234012', '23401234', '40123401', '123b0b23', '34012340', '01234012', '22234012'];
    setBoard(s, cols);
    const center = cell(3, 3);
    const second = cell(3, 5);
    const expected = new Set<number>();
    for (let i = 0; i < 56; i++) {
      if (hexDistance(center, i, bal.board.rows) <= 2 || hexDistance(second, i, bal.board.rows) <= 2) expected.add(i);
    }
    expect(press(s, bal, center)).toEqual([]);
    const ev = release(s, bal);
    const bursts = ev.filter((e) => e.type === 'burst') as Extract<GameEvent, { type: 'burst' }>[];
    expect(bursts.map((b) => [b.cell, b.chained])).toEqual([
      [center, false],
      [second, true],
    ]);
    const popped = new Set(bursts.flatMap((b) => b.cells.map((c) => c.cell)));
    expect(popped).toEqual(expected);
    const score = ev.find((e) => e.type === 'burstScore') as Extract<GameEvent, { type: 'burstScore' }>;
    expect(score.count).toBe(expected.size);
    expect(score.score).toBe(expected.size * bal.score.burstPerBubble + 2 * bal.score.bombBonus);
    expect(s.round!.stats.bursts).toBe(2);
    expect(s.round!.board.cells.every((b) => b.kind === 'color')).toBe(true);
  });

  it('プリズムはタップで同じ色の泡をすべて消す', () => {
    const s = playing();
    setBoard(s, ['0123A012', '23401234', '40123401', '12340123', '34012340', '01234012', '22234012']);
    const zeros = s.round!.board.cells.filter((b) => b.kind === 'color' && b.color === 0).length;
    press(s, bal, cell(0, 4));
    const ev = release(s, bal);
    const burst = ev.find((e) => e.type === 'burst') as Extract<GameEvent, { type: 'burst' }>;
    expect(burst.kind).toBe('prism');
    expect(burst.cells).toHaveLength(zeros + 1);
    expect(burst.cells.slice(1).every((c) => c.color === 0 && c.kind === 'color')).toBe(true);
  });

  it('特別な泡を押したまま指をずらすと、はじけない', () => {
    const s = playing();
    setBoard(s, ['0123b012', '23401234', '40123401', '12340123', '34012340', '01234012', '22234012']);
    press(s, bal, cell(0, 4));
    enter(s, bal, cell(0, 5));
    expect(release(s, bal)).toEqual([]);
    expect(s.round!.board.cells[cell(0, 4)]!.kind).toBe('bomb');
  });
});

describe('コンボとエアロタイム', () => {
  it('続けて消すとコンボが増えて倍率が上がり、間があくと切れる', () => {
    const s = playing();
    setBoard(s, ['00012340', '23401234', '40123401', '12340123', '34012340', '01234012', '22234012']);
    link(s, [cell(0, 0), cell(0, 1), cell(0, 2)]);
    release(s, bal);
    setBoard(s, THREE);
    link(s, [cell(0, 0), cell(0, 1), cell(0, 2)]);
    const pop = release(s, bal).find((e) => e.type === 'pop') as Extract<GameEvent, { type: 'pop' }>;
    expect(pop.combo).toBe(2);
    expect(pop.score).toBe(Math.round(300 * multiplier(bal, 2, false)));
    expect(multiplier(bal, 2, false)).toBeCloseTo(1 + bal.combo.step);
    const ev = run(s, bal.combo.windowSeconds);
    expect(ev).toContainEqual({ type: 'comboEnd', combo: 2 });
    expect(s.round!.combo).toBe(0);
    expect(s.round!.stats.maxCombo).toBe(2);
  });

  it('ゲージがいっぱいになるとエアロタイム：時間が止まり、点が倍になる', () => {
    const s = playing();
    const r = s.round!;
    setBoard(s, THREE);
    r.gauge = bal.fever.need - 3;
    link(s, [cell(0, 0), cell(0, 1), cell(0, 2)]);
    const ev = release(s, bal);
    expect(ev).toContainEqual({ type: 'feverStart', seconds: bal.fever.seconds });
    expect(r.feverLeft).toBe(ticksOf(bal, bal.fever.seconds));
    expect(r.gauge).toBe(0);
    expect(r.feverNeed).toBe(Math.min(bal.fever.needMax, bal.fever.need + bal.fever.needGrowth));
    expect(r.stats.fevers).toBe(1);

    const timeLeft = r.timeLeft;
    run(s, 1);
    expect(r.timeLeft).toBe(timeLeft);

    // エアロタイム中の点は倍（コンボも続いている）
    setBoard(s, THREE);
    link(s, [cell(0, 0), cell(0, 1), cell(0, 2)]);
    const pop = release(s, bal).find((e) => e.type === 'pop') as Extract<GameEvent, { type: 'pop' }>;
    expect(pop.fever).toBe(true);
    expect(pop.score).toBe(Math.round(300 * multiplier(bal, 2, true)));
    expect(multiplier(bal, 2, true)).toBeCloseTo((1 + bal.combo.step) * bal.fever.multiplier);
    // エアロタイム中はゲージがたまらない
    expect(r.gauge).toBe(0);

    const rest = run(s, bal.fever.seconds);
    expect(rest).toContainEqual({ type: 'feverEnd' });
    expect(r.feverLeft).toBe(0);
    expect(r.timeLeft).toBeLessThan(timeLeft);
  });
});

describe('時間切れ', () => {
  it('つないでいる途中の泡はすべりこみで消え、残った特別な泡が順にはじけてから結果になる', () => {
    const s = playing();
    const r = s.round!;
    setBoard(s, ['000340b2', '23401234', '40123401', '12340123', '3401234b', '01234012', '22234012']);
    link(s, [cell(0, 0), cell(0, 1), cell(0, 2)]);
    r.timeLeft = 1;
    const ev = step(s, bal);
    expect(ev[0]).toEqual({ type: 'timeUp', slideIn: true });
    expect(ev.find((e) => e.type === 'pop')).toMatchObject({ length: 3 });
    expect(r.phase).toBe('lastBurst');
    expect(r.burstQueue).toHaveLength(2);
    // 時間切れのあとは触れない
    expect(press(s, bal, cell(3, 3))).toEqual([]);

    const later = run(s, 10);
    const autos = later.filter((e) => e.type === 'burst') as Extract<GameEvent, { type: 'burst' }>[];
    expect(autos.length).toBeGreaterThanOrEqual(1);
    expect(autos.every((b) => b.auto)).toBe(true);
    const end = later.find((e) => e.type === 'roundEnd') as Extract<GameEvent, { type: 'roundEnd' }>;
    expect(end).toBeDefined();
    expect(s.round).toBeNull();
    expect(s.lastResult).toEqual(end.result);
    expect(end.result.score).toBeGreaterThan(0);
    expect(end.result.newBest).toBe(true);
    expect(s.progress).toMatchObject({ rounds: 1, best: end.result.score, recent: [end.result.score] });
    expect(end.result.unlocked).toContain('goldfish');
  });

  it('残り5秒から1秒ごとに知らせる', () => {
    const s = playing();
    s.round!.timeLeft = ticksOf(bal, 6);
    const ev = run(s, 6);
    expect(ev.filter((e) => e.type === 'warn').map((e) => (e as { seconds: number }).seconds)).toEqual([5, 4, 3, 2, 1]);
    expect(ev).toContainEqual({ type: 'timeUp', slideIn: false });
  });
});
