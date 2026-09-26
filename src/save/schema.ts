import { z } from 'zod';
import '../data/schema';

/**
 * セーブの形（上限つき）。読み込むセーブ（書き出したテキストも）は疑う：
 * 大きさ・長さ・数の上限と形を確かめ、知らない鍵（__proto__ など）は取り除く（z.object は知らない鍵を落とす）。
 * GameState に項目を足したら、ここにも上限つきで足す。
 */

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const BIG = 1_000_000_000;

export const SettingsSchema = z.object({
  /** 効果音 */
  sound: z.boolean(),
  /** 音楽 */
  music: z.boolean(),
  /** 振動（対応している端末だけ） */
  vibration: z.boolean(),
  /** 動き：端末の設定に合わせる・減らす・ぜんぶ */
  motion: z.enum(['auto', 'reduce', 'full']),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = { sound: true, music: true, vibration: true, motion: 'auto' };

const BubbleSchema = z.object({
  id: int(0, BIG),
  kind: z.enum(['color', 'bomb', 'prism']),
  color: int(0, 5),
});

const BoardSchema = z
  .object({
    cols: int(3, 12),
    rows: int(3, 14),
    cells: z.array(BubbleSchema).max(12 * 14),
  })
  .refine((b) => b.cells.length === b.cols * b.rows, '盤面の泡の数が合わない');

const RoundStatsSchema = z.object({
  chains: int(0, BIG),
  popped: int(0, BIG),
  maxChain: int(0, 200),
  maxCombo: int(0, BIG),
  fevers: int(0, 10_000),
  bombsMade: int(0, BIG),
  prismsMade: int(0, BIG),
  bursts: int(0, BIG),
  shuffles: int(0, BIG),
});

const RoundStateSchema = z
  .object({
    seed: int(0, 0xffffffff),
    rng: int(-0x80000000, 0x7fffffff),
    tick: int(0, BIG),
    phase: z.enum(['countdown', 'playing', 'lastBurst', 'ended']),
    phaseTicks: int(0, BIG),
    timeLeft: int(0, 100_000),
    board: BoardSchema,
    nextId: int(1, BIG),
    chain: z.array(int(0, 12 * 14 - 1)).max(12 * 14),
    pressed: int(0, 12 * 14 - 1).nullable(),
    score: int(0, 1_000_000_000_000),
    combo: int(0, BIG),
    comboLeft: int(0, 100_000),
    gauge: int(0, 100_000),
    feverNeed: int(1, 100_000),
    feverLeft: int(0, 100_000),
    burstQueue: z.array(int(0, BIG)).max(12 * 14),
    lastBurstAt: int(0, BIG),
    stats: RoundStatsSchema,
  })
  .refine((r) => r.chain.every((c) => c < r.board.cells.length), 'つないでいるマスが盤面の外')
  .refine((r) => r.pressed === null || r.pressed < r.board.cells.length, '押しているマスが盤面の外')
  .refine((r) => r.board.cells.every((b) => b.id < r.nextId), '泡の番号が合わない');

const ProgressSchema = z.object({
  best: int(0, 1_000_000_000_000),
  rounds: int(0, BIG),
  totalPopped: int(0, 1_000_000_000_000),
  totalFevers: int(0, BIG),
  maxChain: int(0, 200),
  bestFevers: int(0, 10_000),
  unlocked: z.array(z.string().regex(/^[a-z][a-z0-9-]{1,23}$/)).max(40),
  tutorialSeen: z.boolean(),
  recent: z.array(int(0, 1_000_000_000_000)).max(50),
});

const RoundResultSchema = z.object({
  score: int(0, 1_000_000_000_000),
  prevBest: int(0, 1_000_000_000_000),
  newBest: z.boolean(),
  stats: RoundStatsSchema,
  unlocked: z.array(z.string().regex(/^[a-z][a-z0-9-]{1,23}$/)).max(40),
});

export const GameStateSchema = z.object({
  schema: z.literal(1),
  progress: ProgressSchema,
  round: RoundStateSchema.nullable(),
  lastResult: RoundResultSchema.nullable(),
});

export const SaveDataSchema = z.object({
  saveVersion: int(1, 1000),
  savedAt: z.number().min(0).max(1e15),
  settings: SettingsSchema,
  state: GameStateSchema,
});
