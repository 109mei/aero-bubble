import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, createState, playRound, type BotProfile, type BotRun } from '../src/core';
import { bal } from './helpers';

/**
 * 手触りの目安（docs/SPEC.md 5章）。ボットで遊んで、目安から外れていないか確かめる。
 * 数値を変えたら npm run sim で測り、ここと SPEC の実測値をそろえる。
 */

const N = 30;
const cache = new Map<string, BotRun[]>();

function runs(p: BotProfile): BotRun[] {
  const hit = cache.get(p.name);
  if (hit) return hit;
  const out: BotRun[] = [];
  for (let i = 0; i < N; i++) out.push(playRound(bal, 2000 + i, p, 3000 + i));
  cache.set(p.name, out);
  return out;
}

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const scores = (p: BotProfile) => runs(p).map((r) => r.result.score);

describe('はじめての人（first）', () => {
  it('点数の中央は 2.5万〜5.5万点', () => {
    const m = median(scores(BOT_PROFILES.first));
    expect(m).toBeGreaterThanOrEqual(25_000);
    expect(m).toBeLessThanOrEqual(55_000);
  });

  it('最初のアクアボムは15秒以内、最初のエアロタイムは12〜30秒（中央）', () => {
    const r = runs(BOT_PROFILES.first);
    const special = r.map((x) => x.firstSpecial ?? 99);
    const fever = r.map((x) => x.firstFever ?? 99);
    expect(median(special)).toBeLessThanOrEqual(15);
    expect(median(fever)).toBeGreaterThanOrEqual(12);
    expect(median(fever)).toBeLessThanOrEqual(30);
    // ほぼ毎回エアロタイムを見られる
    expect(r.filter((x) => x.result.stats.fevers === 0).length).toBeLessThanOrEqual(N * 0.1);
  });

  it('アクアボムは1回に1.5〜6個、プリズムはめったに出ない', () => {
    const st = runs(BOT_PROFILES.first).map((x) => x.result.stats);
    expect(mean(st.map((s) => s.bombsMade))).toBeGreaterThanOrEqual(1.5);
    expect(mean(st.map((s) => s.bombsMade))).toBeLessThanOrEqual(6);
    expect(mean(st.map((s) => s.prismsMade))).toBeLessThanOrEqual(0.3);
  });
});

describe('上達が点に出る', () => {
  it('first < casual < normal < expert（点数の中央）', () => {
    const order = [BOT_PROFILES.first, BOT_PROFILES.casual, BOT_PROFILES.normal, BOT_PROFILES.expert].map((p) => median(scores(p)));
    for (let i = 1; i < order.length; i++) expect(order[i]!).toBeGreaterThan(order[i - 1]! * 1.2);
  });

  it('対照：長さを考えずに3つを速く消し続けても、慣れた人（normal）には勝てない', () => {
    expect(median(scores(BOT_PROFILES.spam))).toBeLessThan(median(scores(BOT_PROFILES.normal)));
  });

  it('上手な人はプリズムにも届く', () => {
    const st = runs(BOT_PROFILES.expert).map((x) => x.result.stats);
    expect(mean(st.map((s) => s.prismsMade))).toBeGreaterThanOrEqual(0.2);
  });

  it('つなぎの長さは平均4〜6で、7つ以上（アクアボム）はその1〜3割', () => {
    const lengths = runs(BOT_PROFILES.casual).flatMap((r) => r.chainLengths);
    expect(mean(lengths)).toBeGreaterThanOrEqual(4);
    expect(mean(lengths)).toBeLessThanOrEqual(6);
    const long = lengths.filter((l) => l >= bal.specials.bombAt).length / lengths.length;
    expect(long).toBeGreaterThanOrEqual(0.1);
    expect(long).toBeLessThanOrEqual(0.3);
  });

  it('手がなくなって並べ直すのは、ふつうに遊べば10回に1回もない', () => {
    const shuffles = runs(BOT_PROFILES.casual).reduce((a, r) => a + r.result.stats.shuffles, 0);
    expect(shuffles).toBeLessThanOrEqual(N / 10);
  });
});

describe('仲間が増えるペース', () => {
  it('1回目で仲間ができ、上達していく人はおよそ15〜35回でぜんぶ集まる', () => {
    const learner = (i: number): BotProfile =>
      i < 3 ? BOT_PROFILES.first : i < 12 ? BOT_PROFILES.casual : i % 2 === 0 ? BOT_PROFILES.normal : BOT_PROFILES.casual;
    const allAt: number[] = [];
    for (let who = 0; who < 4; who++) {
      const s = createState();
      let done = -1;
      for (let i = 0; i < 40 && done < 0; i++) {
        const run = playRound(bal, 40_000 + who * 100 + i, learner(i), 50_000 + who * 100 + i, s);
        if (i === 0) expect(run.result.unlocked.length).toBeGreaterThanOrEqual(1);
        if (s.progress.unlocked.length === bal.creatures.length) done = i + 1;
      }
      allAt.push(done < 0 ? 99 : done);
    }
    expect(median(allAt)).toBeGreaterThanOrEqual(15);
    expect(median(allAt)).toBeLessThanOrEqual(35);
  });
});
