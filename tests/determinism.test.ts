import { describe, expect, it } from 'vitest';
import {
  BOT_PROFILES,
  cancelTouch,
  createRound,
  createState,
  decide,
  enter,
  playRound,
  press,
  release,
  startRound,
  step,
  type GameState,
} from '../src/core';
import { seedRng } from '../src/core/rng';
import { deserialize, serialize, SAVE_VERSION, DEFAULT_SETTINGS } from '../src/save';
import { bal } from './helpers';

/** ticks 刻みのあいだ、20刻みごとにボットの手を指す（テスト用のかんたんな自動あそび） */
function autoplay(s: GameState, ticks: number, rng: { rng: number }): void {
  for (let t = 0; t < ticks && s.round !== null; t++) {
    step(s, bal);
    const r = s.round;
    if (r === null || r.phase !== 'playing' || r.tick % 20 !== 0) continue;
    const act = decide(r, bal, BOT_PROFILES.normal, rng);
    if (act === null) continue;
    if (act.kind === 'burst') {
      press(s, bal, act.cell);
      release(s, bal);
    } else {
      press(s, bal, act.cells[0]!);
      for (const c of act.cells.slice(1)) enter(s, bal, c);
      if (r.chain.length > 0) release(s, bal);
      else cancelTouch(s);
    }
  }
}

describe('同じ種なら同じ結果', () => {
  it('同じ種の盤面は同じで、違う種なら違う', () => {
    expect(createRound(bal, 42).board).toEqual(createRound(bal, 42).board);
    expect(createRound(bal, 42).board).not.toEqual(createRound(bal, 43).board);
  });

  it('同じ種・同じ手なら、最後まで同じ結果になる', () => {
    for (const seed of [1, 2, 3]) {
      const a = playRound(bal, seed, BOT_PROFILES.casual, seed + 100);
      const b = playRound(bal, seed, BOT_PROFILES.casual, seed + 100);
      expect(b.result).toEqual(a.result);
      expect(JSON.stringify(b.state)).toBe(JSON.stringify(a.state));
    }
  });

  it('途中でセーブして読み込んでも、続けて遊んだ結果と一致する', () => {
    const botSeed = 77;
    const s1 = createState();
    startRound(s1, bal, 9);
    autoplay(s1, 3000, { rng: seedRng(botSeed) });

    const s2 = createState();
    startRound(s2, bal, 9);
    const rng = { rng: seedRng(botSeed) };
    autoplay(s2, 700, rng);
    const text = serialize({ saveVersion: SAVE_VERSION, savedAt: 0, settings: DEFAULT_SETTINGS, state: s2 });
    const loaded = deserialize(text).state;
    expect(loaded).toEqual(s2);
    autoplay(loaded, 2300, rng);

    expect(loaded.round).toBeNull();
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(s1));
    expect(loaded.lastResult!.score).toBeGreaterThan(0);
  });
});
