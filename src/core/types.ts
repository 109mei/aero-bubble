/**
 * ルール本体の型。画面（React）・描画（PixiJS）・保存のことは何も知らない。
 * 時間はすべて「刻み」（balance.tickSeconds 秒）で数える。
 */

/** 1回のあそびの段階：数え始め → あそぶ → 時間切れのあとの自動ではじける時間 → 終わり */
export type Phase = 'countdown' | 'playing' | 'lastBurst' | 'ended';

/** 泡の種類：ふつうの色の泡・アクアボム・プリズム */
export type BubbleKind = 'color' | 'bomb' | 'prism';

/** 特別な泡の種類 */
export type SpecialKind = Exclude<BubbleKind, 'color'>;

export interface Bubble {
  /** 泡ごとの番号（描画側が同じ泡を追いかけるのに使う） */
  id: number;
  kind: BubbleKind;
  /** 色（0 から colors-1）。プリズムは作ったつなぎの色、アクアボムは作ったつなぎの色を覚えているだけ */
  color: number;
}

/**
 * 盤面。列は縦にまっすぐ並び、奇数の列は半マス下にずれる（六角形の並び）。
 * cells の並びは列ごと（index = col * rows + row）。row 0 がいちばん上。
 * 泡は水の中を上へ浮かぶので、消えたぶんは上に詰まり、新しい泡は下から湧く。
 */
export interface Board {
  cols: number;
  rows: number;
  cells: Bubble[];
}

/** 1回のあそびの記録 */
export interface RoundStats {
  /** つないで消した回数 */
  chains: number;
  /** はじけた泡の数（アクアボム・プリズムで消えた泡も数える） */
  popped: number;
  /** いちばん長いつなぎ */
  maxChain: number;
  maxCombo: number;
  /** エアロタイムになった回数 */
  fevers: number;
  bombsMade: number;
  prismsMade: number;
  /** アクアボム・プリズムがはじけた数（巻き込まれて連鎖した分も数える） */
  bursts: number;
  /** 動かせる泡がなくなって、並べ直した回数 */
  shuffles: number;
}

export interface RoundState {
  seed: number;
  /** 種つきの疑似乱数の内部状態（泡の色を決めるのに使う） */
  rng: number;
  /** 始めてからの刻み */
  tick: number;
  phase: Phase;
  /** 今の段階に入ってからの刻み */
  phaseTicks: number;
  /** あそべる残りの刻み（エアロタイムの間は減らない） */
  timeLeft: number;
  board: Board;
  nextId: number;
  /** 指でつないでいるマス（並んだ順） */
  chain: number[];
  /** 押したまま、まだ指を離していない特別な泡のマス */
  pressed: number | null;
  score: number;
  /** 続けて消した数（コンボ） */
  combo: number;
  /** コンボが続く残りの刻み（0 で切れる） */
  comboLeft: number;
  /** エアロゲージ（はじけた泡の数） */
  gauge: number;
  /** 次のエアロタイムまでに要る数 */
  feverNeed: number;
  /** エアロタイムの残りの刻み（0 ならエアロタイムではない） */
  feverLeft: number;
  /** 時間切れのあとに順にはじける特別な泡の番号 */
  burstQueue: number[];
  /** 時間切れのあとで、最後にはじけた刻み（lastBurst の段階の中で） */
  lastBurstAt: number;
  stats: RoundStats;
}

/** 遊ぶたびに積み上がる記録と、集めた仲間 */
export interface Progress {
  best: number;
  rounds: number;
  totalPopped: number;
  totalFevers: number;
  maxChain: number;
  /** 1回のなかでエアロタイムになった回数の最多 */
  bestFevers: number;
  /** 仲間になった生き物・景色の id（仲間になった順） */
  unlocked: string[];
  /** あそびかたを見たか */
  tutorialSeen: boolean;
  /** 最近の点数（新しい順） */
  recent: number[];
}

export interface RoundResult {
  score: number;
  /** この回の前の最高点 */
  prevBest: number;
  newBest: boolean;
  stats: RoundStats;
  /** この回で新しく仲間になった id */
  unlocked: string[];
}

export interface GameState {
  schema: 1;
  progress: Progress;
  round: RoundState | null;
  lastResult: RoundResult | null;
}

/** はじけた泡（描画と音に渡す） */
export interface PopCell {
  id: number;
  cell: number;
  color: number;
  kind: BubbleKind;
}

/** ルール本体が出す出来事。画面・音・描画はこれを見て動く */
export type GameEvent =
  | { type: 'countdown'; n: number }
  | { type: 'start' }
  | { type: 'link'; cell: number; length: number; color: number }
  | { type: 'unlink'; cell: number; length: number }
  | { type: 'cancel'; cells: number[] }
  | {
      type: 'pop';
      cells: PopCell[];
      length: number;
      color: number;
      score: number;
      combo: number;
      fever: boolean;
      /** このつなぎで生まれた特別な泡 */
      made: SpecialKind | null;
      madeId: number | null;
    }
  | {
      type: 'burst';
      kind: SpecialKind;
      id: number;
      cell: number;
      color: number;
      cells: PopCell[];
      /** 巻き込まれて連鎖したか */
      chained: boolean;
      /** 時間切れのあとで自動ではじけたか */
      auto: boolean;
    }
  | { type: 'burstScore'; score: number; count: number; combo: number; fever: boolean; auto: boolean; cell: number }
  | { type: 'shuffle' }
  | { type: 'feverStart'; seconds: number }
  | { type: 'feverEnd' }
  | { type: 'comboEnd'; combo: number }
  | { type: 'warn'; seconds: number }
  | { type: 'timeUp'; slideIn: boolean }
  | { type: 'roundEnd'; result: RoundResult };
