import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BalanceSchema, CreaturesSchema } from '../src/data/schema';
import { bal } from './helpers';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), 'utf8')) as unknown;

describe('データの検査', () => {
  it('balance.json と creatures.json が Zod の検査を通る', () => {
    expect(BalanceSchema.safeParse(read('balance.json')).success).toBe(true);
    expect(CreaturesSchema.safeParse(read('creatures.json')).success).toBe(true);
  });

  it('数値の並びに矛盾がない', () => {
    expect(bal.chain.min).toBeLessThan(bal.specials.bombAt);
    expect(bal.specials.bombAt).toBeLessThan(bal.specials.prismAt);
    expect(bal.specials.prismAt).toBeLessThanOrEqual(bal.board.cols * bal.board.rows);
    expect(bal.fever.need).toBeLessThanOrEqual(bal.fever.needMax);
    // 刻みで割り切れる秒数にする（時間の表示と数えがずれないように）
    for (const sec of [bal.round.seconds, bal.round.countdownSeconds, bal.fever.seconds, bal.combo.windowSeconds]) {
      expect(Math.abs(sec / bal.tickSeconds - Math.round(sec / bal.tickSeconds))).toBeLessThan(1e-9);
    }
    expect(Math.abs(1 / bal.tickSeconds - Math.round(1 / bal.tickSeconds))).toBeLessThan(1e-9);
  });

  it('仲間の「ぜんぶ集める」は最後に1つだけ', () => {
    const all = bal.creatures.filter((c) => c.cond.type === 'all');
    expect(all).toHaveLength(1);
    expect(bal.creatures.at(-1)!.cond.type).toBe('all');
  });

  it('壊れた数値は検査で弾かれる', () => {
    const raw = read('balance.json') as Record<string, any>;
    expect(BalanceSchema.safeParse({ ...raw, board: { ...raw.board, colors: 9 } }).success).toBe(false);
    expect(BalanceSchema.safeParse({ ...raw, tickSeconds: 0 }).success).toBe(false);
    const dup = read('creatures.json') as unknown[];
    expect(CreaturesSchema.safeParse([...dup, dup[0]]).success).toBe(false);
  });
});
