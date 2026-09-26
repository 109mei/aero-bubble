// 読み込めるものを絞る決まり（CSP）の下でも動くよう、PixiJS に文字列からコードを作らせない
import 'pixi.js/unsafe-eval';
import { Application } from 'pixi.js';
import type { GameEvent, GameState } from '../core';
import { BoardView, type WorldMode } from './board';
import type { Layout } from './layout';
import { Sea } from './sea';

export type { WorldMode } from './board';

/**
 * 画面いっぱいの絵（PixiJS）。ルール本体の状態を毎フレーム読んで描くだけで、状態は書き換えない。
 * 文字は描かない（点数・知らせは HTML 側）。
 */
export class World {
  private readonly sea = new Sea();
  private readonly board = new BoardView();
  private layout: Layout;
  private surface = -1;
  private fever = 0;
  private lastMs: number | null = null;
  private unlockedKey = '';
  private unlocked: ReadonlySet<string> = new Set();

  private constructor(
    private readonly app: Application,
    layout: Layout,
  ) {
    this.layout = layout;
    app.stage.addChild(this.sea.root, this.board.root);
  }

  /** host の中に canvas を1つ置く */
  static async create(host: HTMLElement, layout: Layout): Promise<World> {
    const app = new Application();
    await app.init({
      width: layout.vw,
      height: layout.vh,
      background: '#2F9BEE',
      antialias: true,
      autoDensity: true,
      resolution: World.resolution(),
      preference: 'webgl',
      autoStart: false,
      sharedTicker: false,
    });
    app.canvas.setAttribute('aria-hidden', 'true');
    app.canvas.dataset.testid = 'world';
    host.appendChild(app.canvas);
    const w = new World(app, layout);
    w.resize(layout);
    return w;
  }

  private static resolution(): number {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return Math.min(2, Math.max(1, dpr));
  }

  resize(layout: Layout): void {
    this.layout = layout;
    const res = World.resolution();
    this.app.renderer.resolution = res;
    this.app.renderer.resize(layout.vw, layout.vh);
    this.sea.resize(layout, res);
    this.board.resize(layout, res);
  }

  /** 毎フレーム呼ぶ */
  render(state: GameState, events: GameEvent[], mode: WorldMode, reduced: boolean, nowMs: number, minChain: number): void {
    const now = nowMs / 1000;
    const dt = this.lastMs === null ? 0 : Math.min(0.1, Math.max(0, (nowMs - this.lastMs) / 1000));
    this.lastMs = nowMs;
    const L = this.layout;
    const target = mode === 'title' ? L.surfaceTitle : L.surfaceGame;
    if (this.surface < 0 || reduced) this.surface = target;
    else this.surface += (target - this.surface) * Math.min(1, dt * 3.5);
    const feverOn = (state.round?.feverLeft ?? 0) > 0 ? 1 : 0;
    this.fever += (feverOn - this.fever) * Math.min(1, dt * 2.5);
    const key = state.progress.unlocked.join(',');
    if (key !== this.unlockedKey) {
      this.unlockedKey = key;
      this.unlocked = new Set(state.progress.unlocked);
    }
    this.sea.update({ layout: L, surface: this.surface, now, dt, reduced, fever: this.fever, unlocked: this.unlocked });
    this.board.update({ state, events, now, dt, reduced, mode, minChain });
    this.app.render();
  }

  /** テスト用：盤面の描画の数 */
  stats(): ReturnType<BoardView['stats']> {
    return this.board.stats();
  }

  destroy(): void {
    this.sea.destroy();
    this.board.destroy();
    this.app.destroy(true, { children: true });
  }
}
