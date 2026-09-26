import * as core from '../core';
import type { Bubble, GameEvent, GameState, Progress, SpecialKind } from '../core';
import type { GameData } from '../data';
import { DEFAULT_SETTINGS, exportText, importText, SAVE_VERSION, type SaveData, type SaveStore, type Settings } from '../save';

export interface RuntimeOptions {
  bal: GameData;
  store: SaveStore;
  /** 実際の時刻（ミリ秒）。ルール本体には渡さず、セーブの時刻にだけ使う */
  now: () => number;
  /** 新しくあそぶときの種を作る */
  newSeed: () => number;
  /** 時間の進みの倍率（?speed=） */
  speed: number;
}

export type Listener = (ev: GameEvent[]) => void;

/**
 * ルール本体を動かす係。状態の持ち主は core で、ここは命令を渡し、決まった刻みで進め、保存するだけ。
 * 画面（React）と描画（PixiJS）はここから状態を読む。
 */
export class GameRuntime {
  state: GameState = core.createState();
  settings: Settings = { ...DEFAULT_SETTINGS };
  readonly bal: GameData;
  /** 一時停止中（止めるシートを開いている） */
  paused = false;
  /** 保存に失敗した（プライベートモード・容量不足など） */
  saveFailed = false;
  /** セーブを読めなかった（壊れていた） */
  loadFailed = false;
  private readonly store: SaveStore;
  private readonly now: () => number;
  private readonly newSeed: () => number;
  private readonly speed: number;
  private hidden = false;
  private acc = 0;
  private lastFrameMs: number | null = null;
  private lastSaveMs = 0;
  private readonly listeners = new Set<Listener>();
  private worldEvents: GameEvent[] = [];

  constructor(opts: RuntimeOptions) {
    this.bal = opts.bal;
    this.store = opts.store;
    this.now = opts.now;
    this.newSeed = opts.newSeed;
    this.speed = opts.speed;
  }

  /** セーブを読み込む。あそびの途中だったら一時停止のまま返す（true） */
  async boot(): Promise<boolean> {
    let data: SaveData | null = null;
    try {
      data = await this.store.load();
    } catch {
      this.loadFailed = true;
    }
    if (data !== null) {
      this.state = data.state;
      this.settings = data.settings;
    }
    let resumed = false;
    if (this.state.round !== null) {
      if (this.state.round.phase === 'ended') this.state.round = null;
      else {
        this.state.round.chain = [];
        this.state.round.pressed = null;
        this.paused = true;
        resumed = true;
      }
    }
    this.save();
    return resumed;
  }

  addListener(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(ev: GameEvent[]): void {
    if (ev.length === 0) return;
    this.worldEvents.push(...ev);
    for (const fn of this.listeners) fn(ev);
    if (ev.some((e) => e.type === 'roundEnd')) this.save();
  }

  /** 描画（泡がはじける・つながる）に使う出来事を取り出す */
  drainWorldEvents(): GameEvent[] {
    const out = this.worldEvents;
    this.worldEvents = [];
    return out;
  }

  /** 毎フレームとタイマーから呼ぶ。経った時間ぶん、決まった刻みでルール本体を進める */
  frame(nowMs: number): void {
    if (this.state.round === null || this.paused || this.hidden) {
      this.lastFrameMs = null;
      this.acc = 0;
      return;
    }
    if (this.lastFrameMs === null) {
      this.lastFrameMs = nowMs;
      this.lastSaveMs = nowMs;
      return;
    }
    // 時刻が戻ったときは数えない（同じ時間を二重に進めないため）
    if (nowMs <= this.lastFrameMs) return;
    const dt = (nowMs - this.lastFrameMs) / 1000;
    this.lastFrameMs = nowMs;
    const tick = this.bal.tickSeconds;
    const maxTicks = this.bal.display.maxTicksPerFrame;
    this.acc += dt * this.speed;
    let n = 0;
    while (this.acc >= tick - 1e-9 && n < maxTicks && this.state.round !== null) {
      this.emit(core.step(this.state, this.bal));
      this.acc -= tick;
      n += 1;
    }
    if (n >= maxTicks) this.acc = 0;
    if (this.state.round !== null && nowMs - this.lastSaveMs >= this.bal.save.autosaveSeconds * 1000) {
      this.lastSaveMs = nowMs;
      this.save();
    }
  }

  save(): void {
    const data: SaveData = { saveVersion: SAVE_VERSION, savedAt: this.now(), settings: { ...this.settings }, state: this.state };
    this.store
      .save(data)
      .then(() => {
        this.saveFailed = false;
      })
      .catch(() => {
        this.saveFailed = true;
      });
  }

  // ------------------------------------------------------------ 命令

  startRound(): void {
    this.paused = false;
    this.acc = 0;
    this.lastFrameMs = null;
    this.emit(core.startRound(this.state, this.bal, this.newSeed()));
    this.save();
  }

  press(cell: number): void {
    this.emit(core.press(this.state, this.bal, cell));
  }

  enter(cell: number): void {
    this.emit(core.enter(this.state, this.bal, cell));
  }

  release(): void {
    this.emit(core.release(this.state, this.bal));
  }

  cancelTouch(): void {
    this.emit(core.cancelTouch(this.state));
  }

  pause(): void {
    if (this.state.round === null) return;
    this.cancelTouch();
    this.paused = true;
    this.save();
  }

  resume(): void {
    this.paused = false;
    this.lastFrameMs = null;
    this.acc = 0;
  }

  /** あそびをやめてタイトルへ（記録には足さない） */
  quitRound(): void {
    core.abandonRound(this.state);
    this.paused = false;
    this.save();
  }

  markTutorialSeen(): void {
    if (this.state.progress.tutorialSeen) return;
    this.state.progress.tutorialSeen = true;
    this.save();
  }

  setSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.save();
  }

  onHidden(): void {
    this.cancelTouch();
    this.hidden = true;
    this.save();
  }

  onVisible(): void {
    this.hidden = false;
    this.lastFrameMs = null;
    this.acc = 0;
  }

  exportSave(): string {
    return exportText({ saveVersion: SAVE_VERSION, savedAt: this.now(), settings: { ...this.settings }, state: this.state });
  }

  /** 書き出したテキストを読み込む。読めなければ例外（今の記録はそのまま） */
  importSave(text: string): void {
    const data = importText(text);
    this.state = { ...data.state, round: null, lastResult: null };
    this.settings = data.settings;
    this.paused = false;
    this.worldEvents = [];
    this.save();
  }

  /** 記録をすべて消して最初から */
  resetAll(): void {
    const settings = this.settings;
    this.state = core.createState();
    this.settings = settings;
    this.paused = false;
    this.worldEvents = [];
    this.save();
  }

  // ------------------------------------------------------------ テスト・スクリーンショット用（?debug=1 のときだけ公開）

  debugStep(seconds: number): void {
    const n = Math.round(seconds / this.bal.tickSeconds);
    for (let i = 0; i < n && this.state.round !== null; i++) this.emit(core.step(this.state, this.bal));
  }

  /** 数え始めを飛ばす */
  debugSkipCountdown(): void {
    let guard = 0;
    while (this.state.round?.phase === 'countdown' && guard++ < 1000) this.emit(core.step(this.state, this.bal));
  }

  debugSetGauge(n: number): void {
    const r = this.state.round;
    if (r) r.gauge = Math.max(0, Math.min(r.feverNeed - 1, Math.floor(n)));
  }

  debugSetTimeLeft(seconds: number): void {
    const r = this.state.round;
    if (r) r.timeLeft = Math.max(1, Math.round(seconds / this.bal.tickSeconds));
  }

  debugPlaceSpecial(kind: SpecialKind, cell: number, color = 0): void {
    const r = this.state.round;
    if (!r || cell < 0 || cell >= r.board.cells.length) return;
    const b: Bubble = { id: r.nextId++, kind, color };
    r.board.cells[cell] = b;
  }

  debugSetColors(colors: number[]): void {
    const r = this.state.round;
    if (!r) return;
    colors.forEach((c, i) => {
      const b = r.board.cells[i];
      if (b && b.kind === 'color') r.board.cells[i] = { ...b, color: c };
    });
  }

  debugGrant(patch: Partial<Progress>): void {
    Object.assign(this.state.progress, patch);
    core.checkUnlocks(this.state.progress, this.bal.creatures);
    this.save();
  }
}
