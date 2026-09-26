import { BOT_PROFILES, createState, playRound, type BotProfile, type BotRun } from '../src/core';
import { gameData } from '../src/data';

/**
 * npm run sim -- [ボット] [回数]
 * ボット（first / casual / normal / expert / all）ごとに、1回のあそびの点数・つなぎ・エアロタイムを数える。
 * npm run sim -- progress [回数]：casual で続けて遊んだとき、何回目で仲間が増えるか
 */

const [, , which = 'all', countArg = '40'] = process.argv;
const count = Math.max(1, Number(countArg) || 40);

function quantile(xs: number[], q: number): number {
  const s = xs.slice().sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo]! + (s[hi]! - s[lo]!) * (i - lo);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const fmt = (x: number, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '-');

function summarize(p: BotProfile, runs: BotRun[]): void {
  const score = runs.map((r) => r.result.score);
  const st = runs.map((r) => r.result.stats);
  const lengths = runs.flatMap((r) => r.chainLengths);
  const fever = runs.map((r) => r.firstFever).filter((x): x is number => x !== null);
  const special = runs.map((r) => r.firstSpecial).filter((x): x is number => x !== null);
  const total = runs.reduce((a, r) => a + r.result.score, 0);
  const share = (x: number) => fmt((100 * x) / Math.max(1, total));
  const hist = [3, 4, 5, 6, 7, 8, 9, 10, 11]
    .map((n) => `${n}${n === 11 ? '+' : ''}:${fmt((100 * lengths.filter((l) => (n === 11 ? l >= 11 : l === n)).length) / Math.max(1, lengths.length))}%`)
    .join(' ');
  console.log(`\n== ${p.name}（${runs.length}回）`);
  console.log(`点数        平均 ${fmt(mean(score))}  中央 ${fmt(quantile(score, 0.5))}  下位10% ${fmt(quantile(score, 0.1))}  上位10% ${fmt(quantile(score, 0.9))}`);
  console.log(`点の内訳    つなぎ ${share(runs.reduce((a, r) => a + r.chainPoints, 0))}%  ボム・プリズム ${share(runs.reduce((a, r) => a + r.burstPoints, 0))}%  （うちエアロタイム中 ${share(runs.reduce((a, r) => a + r.feverPoints, 0))}%）`);
  console.log(`つないだ回数 平均 ${fmt(mean(st.map((s) => s.chains)), 1)}   はじけた泡 平均 ${fmt(mean(st.map((s) => s.popped)), 1)}   つなぎの長さ 平均 ${fmt(mean(lengths), 2)}`);
  console.log(`長さの分布  ${hist}`);
  console.log(`最長つなぎ   平均 ${fmt(mean(st.map((s) => s.maxChain)), 1)}  最大 ${Math.max(...st.map((s) => s.maxChain))}   最大コンボ 平均 ${fmt(mean(st.map((s) => s.maxCombo)), 1)}`);
  console.log(`アクアボム   平均 ${fmt(mean(st.map((s) => s.bombsMade)), 2)}   プリズム 平均 ${fmt(mean(st.map((s) => s.prismsMade)), 2)}   はじけさせた 平均 ${fmt(mean(st.map((s) => s.bursts)), 2)}`);
  console.log(`エアロタイム 平均 ${fmt(mean(st.map((s) => s.fevers)), 2)}回   0回の割合 ${fmt((100 * st.filter((s) => s.fevers === 0).length) / st.length)}%   最初まで 中央 ${fmt(quantile(fever, 0.5), 1)}秒`);
  console.log(`最初の特別な泡まで 中央 ${fmt(quantile(special, 0.5), 1)}秒（できなかった回 ${runs.length - special.length}）   並べ直し 合計 ${st.reduce((a, s) => a + s.shuffles, 0)}`);
}

function runProfile(p: BotProfile): BotRun[] {
  const runs: BotRun[] = [];
  for (let i = 0; i < count; i++) runs.push(playRound(gameData, 1000 + i, p, 7000 + i));
  return runs;
}

/** 上達していく人：最初の3回は first、12回目までは casual、そのあとは casual と normal を交互に */
function learner(i: number): BotProfile {
  if (i < 3) return BOT_PROFILES.first;
  if (i < 12) return BOT_PROFILES.casual;
  return i % 2 === 0 ? BOT_PROFILES.normal : BOT_PROFILES.casual;
}

if (which === 'progress') {
  // 続けて遊んだとき、何回目で仲間が増えるか（上達していく人を、種を変えて何人か）
  const players = 12;
  const at = new Map<string, number[]>();
  for (let who = 0; who < players; who++) {
    const s = createState();
    for (let i = 0; i < count; i++) {
      const run = playRound(gameData, 5000 + who * 1000 + i, learner(i), 9000 + who * 1000 + i, s);
      for (const id of run.result.unlocked) at.set(id, [...(at.get(id) ?? []), i + 1]);
    }
  }
  console.log(`\n== 上達していく人 ${players}人が ${count}回ずつ遊んだとき、仲間が増えた回（中央・早い人・遅い人／増えなかった人数）`);
  for (const c of gameData.creatures) {
    const xs = at.get(c.id) ?? [];
    const cond = 'n' in c.cond ? `${c.cond.type} ${c.cond.n}` : c.cond.type;
    console.log(
      `${c.name.padEnd(7, '　')} ${cond.padEnd(18)} 中央 ${fmt(quantile(xs, 0.5)).padStart(3)}  早 ${fmt(quantile(xs, 0)).padStart(3)}  遅 ${fmt(quantile(xs, 1)).padStart(3)}  ／${players - xs.length}`,
    );
  }
} else {
  const names = which === 'all' ? (Object.keys(BOT_PROFILES) as (keyof typeof BOT_PROFILES)[]) : [which as keyof typeof BOT_PROFILES];
  for (const n of names) {
    const p = BOT_PROFILES[n];
    if (!p) throw new Error(`ボットの名前が違う：${n}`);
    summarize(p, runProfile(p));
  }
}
