import type { GameData } from '../data';
import type { Condition, Creature } from '../data/schema';
import type { Progress, RoundResult, RoundState } from './types';

export function createProgress(): Progress {
  return {
    best: 0,
    rounds: 0,
    totalPopped: 0,
    totalFevers: 0,
    maxChain: 0,
    bestFevers: 0,
    unlocked: [],
    tutorialSeen: false,
    recent: [],
  };
}

/** 条件の進み具合（value / target）。target に届いたら仲間になる */
export function conditionProgress(p: Progress, cond: Condition, creatures: Creature[]): { value: number; target: number } {
  switch (cond.type) {
    case 'rounds':
      return { value: p.rounds, target: cond.n };
    case 'popped':
      return { value: p.totalPopped, target: cond.n };
    case 'chain':
      return { value: p.maxChain, target: cond.n };
    case 'fevers':
      return { value: p.totalFevers, target: cond.n };
    case 'feversInRound':
      return { value: p.bestFevers, target: cond.n };
    case 'score':
      return { value: p.best, target: cond.n };
    case 'all': {
      const others = creatures.filter((c) => c.cond.type !== 'all');
      return { value: others.filter((c) => p.unlocked.includes(c.id)).length, target: others.length };
    }
  }
}

/** 条件を満たした仲間を増やす。増えた id を返す（ぜんぶ集める条件のため、増えなくなるまで見直す） */
export function checkUnlocks(p: Progress, creatures: Creature[]): string[] {
  const added: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of creatures) {
      if (p.unlocked.includes(c.id)) continue;
      const { value, target } = conditionProgress(p, c.cond, creatures);
      if (value >= target) {
        p.unlocked.push(c.id);
        added.push(c.id);
        changed = true;
      }
    }
  }
  return added;
}

/** 1回のあそびの結果を記録に足す */
export function applyResult(p: Progress, r: RoundState, bal: GameData): RoundResult {
  const prevBest = p.best;
  p.best = Math.max(p.best, r.score);
  p.rounds += 1;
  p.totalPopped += r.stats.popped;
  p.totalFevers += r.stats.fevers;
  p.maxChain = Math.max(p.maxChain, r.stats.maxChain);
  p.bestFevers = Math.max(p.bestFevers, r.stats.fevers);
  p.recent = [r.score, ...p.recent].slice(0, bal.display.recentScores);
  const unlocked = checkUnlocks(p, bal.creatures);
  return { score: r.score, prevBest, newBest: r.score > prevBest, stats: { ...r.stats }, unlocked };
}
