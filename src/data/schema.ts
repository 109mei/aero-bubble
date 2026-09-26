import { z } from 'zod';

// 文字列からコードを作らない（eval を使わない）。読み込めるものを絞る決まり（CSP）の下でも、決まりに触れずに動くように
z.config({ jitless: true });

const seconds = z.number().positive().max(600);

/** balance.json：ルールの数値。読み込むときに型と範囲を確かめる */
export const BalanceSchema = z.object({
  /** ルール本体を進める刻み（秒） */
  tickSeconds: z.number().min(0.01).max(0.2),
  board: z.object({
    cols: z.number().int().min(3).max(12),
    rows: z.number().int().min(3).max(14),
    /** 泡の色の数 */
    colors: z.number().int().min(3).max(6),
  }),
  round: z.object({
    /** 1回にあそべる秒数 */
    seconds,
    /** はじめの数え（3・2・1）の秒数 */
    countdownSeconds: z.number().int().min(1).max(5),
    /** 残りがこの秒数になったら、1秒ごとに知らせる */
    warnSeconds: z.number().int().min(0).max(15),
    /** 時間切れのあと、残った特別な泡を1つずつはじけさせる間隔（秒） */
    lastBurstIntervalSeconds: z.number().positive().max(2),
    /** 最後の泡がはじけてから結果を出すまで（秒） */
    endDelaySeconds: z.number().min(0).max(5),
  }),
  chain: z.object({
    /** 消すのに要る最小のつなぎ */
    min: z.number().int().min(2).max(5),
  }),
  score: z.object({
    /** つないだ泡1つの点 */
    perBubble: z.number().int().min(1),
    /** 長いつなぎの上乗せ。min を超えた k 個目ごとに lengthStep × k を足す */
    lengthStep: z.number().int().min(0),
    /** アクアボム・プリズムで消えた泡1つの点 */
    burstPerBubble: z.number().int().min(1),
    bombBonus: z.number().int().min(0),
    prismBonus: z.number().int().min(0),
  }),
  specials: z.object({
    /** この長さ以上つなぐとアクアボムが生まれる */
    bombAt: z.number().int().min(3).max(30),
    /** この長さ以上つなぐとプリズムが生まれる */
    prismAt: z.number().int().min(3).max(40),
    /** アクアボムがはじけさせる範囲（六角形の距離） */
    bombRadius: z.number().int().min(1).max(4),
  }),
  combo: z.object({
    /** 前に消してからこの秒数の間に次を消すと、コンボが続く */
    windowSeconds: seconds,
    /** コンボ1つごとの倍率の上乗せ */
    step: z.number().min(0).max(1),
    /** 倍率の上乗せを数えるコンボの上限 */
    cap: z.number().int().min(0).max(200),
  }),
  fever: z.object({
    /** 最初のエアロタイムに要る泡の数 */
    need: z.number().int().min(1),
    /** エアロタイムのたびに増える要る数 */
    needGrowth: z.number().int().min(0),
    needMax: z.number().int().min(1),
    /** エアロタイムの秒数（この間は時間が減らない） */
    seconds,
    /** エアロタイム中の点の倍率 */
    multiplier: z.number().min(1).max(10),
  }),
  display: z.object({
    /** 画面の数字（React）を写し直す回数（1秒あたり） */
    uiHz: z.number().int().min(1).max(60),
    /** 1フレームで進める刻みの上限（止まっていたときに一気に進めすぎない） */
    maxTicksPerFrame: z.number().int().min(1).max(200),
    /** 最近の点数を覚えておく数 */
    recentScores: z.number().int().min(1).max(50),
  }),
  save: z.object({
    autosaveSeconds: z.number().positive().max(120),
  }),
});

export type Balance = z.infer<typeof BalanceSchema>;

/** 仲間になる条件 */
export const ConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rounds'), n: z.number().int().min(1) }),
  z.object({ type: z.literal('popped'), n: z.number().int().min(1) }),
  z.object({ type: z.literal('chain'), n: z.number().int().min(2) }),
  z.object({ type: z.literal('fevers'), n: z.number().int().min(1) }),
  z.object({ type: z.literal('feversInRound'), n: z.number().int().min(1) }),
  z.object({ type: z.literal('score'), n: z.number().int().min(1) }),
  z.object({ type: z.literal('all') }),
]);

export type Condition = z.infer<typeof ConditionSchema>;

/** creatures.json：アクアリウムの仲間（生き物と景色） */
export const CreatureSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,23}$/),
  name: z.string().min(1).max(12),
  /** 水槽の中にいるか、空・丘の景色か */
  place: z.enum(['tank', 'sky']),
  desc: z.string().min(1).max(60),
  cond: ConditionSchema,
});

export const CreaturesSchema = z
  .array(CreatureSchema)
  .min(1)
  .max(40)
  .refine((list) => new Set(list.map((c) => c.id)).size === list.length, '仲間の id が重なっている');

export type Creature = z.infer<typeof CreatureSchema>;
