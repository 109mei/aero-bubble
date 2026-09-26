import { describe, expect, it } from 'vitest';
import { applyResult, checkUnlocks, conditionProgress, createProgress, createRound } from '../src/core';
import { bal } from './helpers';

describe('記録と仲間', () => {
  it('1回あそぶと、最高点・回数・最近の点数が記録される', () => {
    const p = createProgress();
    const r = createRound(bal, 1);
    r.score = 12_345;
    r.stats.popped = 150;
    r.stats.fevers = 2;
    r.stats.maxChain = 6;
    const res = applyResult(p, r, bal);
    expect(res).toMatchObject({ score: 12_345, prevBest: 0, newBest: true });
    expect(p).toMatchObject({ best: 12_345, rounds: 1, totalPopped: 150, totalFevers: 2, maxChain: 6, bestFevers: 2, recent: [12_345] });
    expect(res.unlocked).toEqual(['goldfish']);

    r.score = 5_000;
    const res2 = applyResult(p, r, bal);
    expect(res2).toMatchObject({ prevBest: 12_345, newBest: false });
    expect(p.best).toBe(12_345);
    expect(p.recent).toEqual([5_000, 12_345]);
  });

  it('最近の点数は決まった数だけ覚える', () => {
    const p = createProgress();
    const r = createRound(bal, 1);
    for (let i = 0; i < bal.display.recentScores + 5; i++) {
      r.score = i;
      applyResult(p, r, bal);
    }
    expect(p.recent).toHaveLength(bal.display.recentScores);
    expect(p.recent[0]).toBe(bal.display.recentScores + 4);
  });

  it('条件を満たすと仲間になり、ぜんぶ集めると最後の仲間が来る', () => {
    const p = createProgress();
    p.maxChain = 7;
    expect(checkUnlocks(p, bal.creatures)).toEqual(['clownfish']);
    expect(checkUnlocks(p, bal.creatures)).toEqual([]);

    const last = bal.creatures.find((c) => c.cond.type === 'all')!;
    const others = bal.creatures.filter((c) => c.cond.type !== 'all');
    expect(conditionProgress(p, last.cond, bal.creatures)).toEqual({ value: 1, target: others.length });

    p.rounds = 1_000;
    p.totalPopped = 1_000_000;
    p.maxChain = 50;
    p.totalFevers = 1_000;
    p.bestFevers = 100;
    p.best = 100_000_000;
    const added = checkUnlocks(p, bal.creatures);
    expect(added.at(-1)).toBe(last.id);
    expect(new Set(p.unlocked)).toEqual(new Set(bal.creatures.map((c) => c.id)));
  });

  it('条件の進み具合は、記録の数字をそのまま使う', () => {
    const p = createProgress();
    p.totalPopped = 321;
    const tetra = bal.creatures.find((c) => c.id === 'tetra')!;
    expect(conditionProgress(p, tetra.cond, bal.creatures)).toEqual({ value: 321, target: (tetra.cond as { n: number }).n });
  });
});
