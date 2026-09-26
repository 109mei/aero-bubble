import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { bestChain, hexDistance, type Bubble, type GameEvent, type GameState, type PopCell } from '../core';
import { BUBBLE_COLORS, paintBeam, paintBomb, paintBubble, paintDot, paintDroplet, paintGlow, paintPrism, paintRing, paintSparkle } from './art/bubbles';
import { paintPanel } from './art/scenery';
import { Fx } from './fx';
import { cellCenter, type Layout } from './layout';
import { LinkView } from './link';
import { pointer } from './pointer';
import { canvasTexture, TextureBag } from './textures';

/**
 * 泡の盤面（基準の座標。root を拡大して置く）。ルール本体の盤面を毎フレーム読んで描くだけで、書き換えない。
 * 泡は番号（id）で追いかけ、上へ詰まる・下から湧く動きをばねで見せる。
 */

export type WorldMode = 'title' | 'game' | 'result';

export interface BoardFrame {
  state: GameState;
  events: GameEvent[];
  now: number;
  dt: number;
  reduced: boolean;
  mode: WorldMode;
  minChain: number;
}

interface BubbleSprite {
  id: number;
  key: string;
  bubble: Bubble;
  sprite: Sprite;
  ring: Sprite;
  glow: Sprite | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 現れた時刻（ぽんと出る動き） */
  born: number;
  shake: number;
}

interface Dying {
  sprite: Sprite;
  delay: number;
  age: number;
  size: number;
}

const HINT_AFTER = 5;

/** 少し行きすぎてから戻る（ぽんと現れる動き） */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export class BoardView {
  readonly root = new Container();
  private readonly bag = new TextureBag();
  private readonly panel = new Sprite();
  private readonly layer = new Container();
  private readonly maskG = new Graphics();
  private readonly glowLayer = new Container();
  private readonly bubbleLayer = new Container();
  private readonly ringLayer = new Container();
  private readonly link: LinkView;
  private readonly fx = new Fx();
  private readonly sprites = new Map<number, BubbleSprite>();
  private dying: Dying[] = [];
  private layout: Layout | null = null;
  private px = 0;
  private roundRef: unknown = null;
  private visible = 0;
  private lastActivity = 0;
  /** 長くつないで生まれた特別な泡は、最後の泡の場所から現れる（id → 場所） */
  private readonly spawnAt = new Map<number, { x: number; y: number }>();
  private hint: number[] = [];
  private hintKey = '';
  private feverGlow = new Sprite();
  private readonly tex: { glow: Texture; ring: Texture; drop: Texture; spark: Texture };

  constructor() {
    const b = this.bag;
    this.tex = {
      glow: b.get('glow', () => canvasTexture(128, 128, (c, w) => paintGlow(c, w))),
      ring: b.get('ring', () => canvasTexture(128, 128, (c, w) => paintRing(c, w, 7))),
      drop: b.get('drop', () => canvasTexture(32, 32, (c, w) => paintDroplet(c, w))),
      spark: b.get('spark', () => canvasTexture(64, 64, (c, w) => paintSparkle(c, w))),
    };
    this.link = new LinkView(
      b.get('beam', () => canvasTexture(64, 32, (c, w, h) => paintBeam(c, w, h))),
      b.get('dot', () => canvasTexture(64, 64, (c, w) => paintDot(c, w))),
    );
    this.glowLayer.blendMode = 'add';
    this.feverGlow.texture = this.tex.glow;
    this.feverGlow.anchor.set(0.5);
    this.feverGlow.blendMode = 'add';
    this.feverGlow.alpha = 0;
    this.layer.addChild(this.glowLayer, this.bubbleLayer, this.ringLayer);
    this.layer.mask = this.maskG;
    this.root.addChild(this.feverGlow, this.panel, this.maskG, this.layer, this.link.root, this.fx.root, this.fx.addRoot);
  }

  resize(layout: Layout, res: number): void {
    this.layout = layout;
    const px = Math.max(8, Math.round(2 * layout.board.r * layout.scale * res));
    const P = layout.panel;
    const pw = Math.ceil(P.w * layout.scale * res);
    const ph = Math.ceil(P.h * layout.scale * res);
    const key = `${px}:${pw}x${ph}`;
    this.root.position.set(layout.offsetX, layout.offsetY);
    this.root.scale.set(layout.scale);
    this.maskG.clear();
    this.maskG.roundRect(P.x + 3, P.y + 3, P.w - 6, P.h - 6, 22).fill(0xffffff);
    this.panel.position.set(P.x, P.y);
    if (key !== this.sizeKey) {
      this.sizeKey = key;
      this.bag.drop('size:');
      this.px = px;
      this.panel.texture = this.bag.get(`size:panel:${pw}x${ph}`, () => canvasTexture(pw, ph, (c, w, h) => paintPanel(c, w, h, 26 * layout.scale * res)));
      for (const s of this.sprites.values()) this.applyTexture(s, true);
    }
    this.panel.width = P.w;
    this.panel.height = P.h;
    this.relayout();
  }

  private sizeKey = '';

  /** 画面の大きさが変わったら、泡をすぐ新しい場所へ */
  private relayout(): void {
    const L = this.layout;
    const r = this.roundCells();
    if (!L || !r) return;
    r.forEach((b, i) => {
      const s = this.sprites.get(b.id);
      if (!s) return;
      const c = cellCenter(L.board, i);
      s.x = c.x;
      s.y = c.y;
      s.vx = 0;
      s.vy = 0;
    });
  }

  private lastState: GameState | null = null;

  private roundCells(): Bubble[] | null {
    return this.lastState?.round?.board.cells ?? null;
  }

  private bubbleTexture(b: Bubble): Texture {
    const px = this.px;
    const color = BUBBLE_COLORS[b.color % BUBBLE_COLORS.length]!;
    if (b.kind === 'bomb') return this.bag.get(`size:bomb:${px}`, () => canvasTexture(px, px, (c, w) => paintBomb(c, w)));
    if (b.kind === 'prism') return this.bag.get(`size:prism:${b.color}:${px}`, () => canvasTexture(px, px, (c, w) => paintPrism(c, w, color)));
    return this.bag.get(`size:bubble:${b.color}:${px}`, () => canvasTexture(px, px, (c, w) => paintBubble(c, w, color)));
  }

  private applyTexture(s: BubbleSprite, force = false): void {
    const key = `${s.bubble.kind}:${s.bubble.color}`;
    if (!force && key === s.key) return;
    s.key = key;
    s.sprite.texture = this.bubbleTexture(s.bubble);
    if (s.bubble.kind !== 'color') {
      if (!s.glow) {
        s.glow = new Sprite(this.tex.glow);
        s.glow.anchor.set(0.5);
        this.glowLayer.addChild(s.glow);
      }
      s.glow.tint = s.bubble.kind === 'bomb' ? 0x7fe8ff : BUBBLE_COLORS[s.bubble.color % BUBBLE_COLORS.length]!.glow;
    } else if (s.glow) {
      s.glow.destroy();
      s.glow = null;
    }
  }

  private makeSprite(b: Bubble, x: number, y: number, born: number): BubbleSprite {
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    const ring = new Sprite(this.tex.ring);
    ring.anchor.set(0.5);
    ring.visible = false;
    this.bubbleLayer.addChild(sprite);
    this.ringLayer.addChild(ring);
    const s: BubbleSprite = { id: b.id, key: '', bubble: b, sprite, ring, glow: null, x, y, vx: 0, vy: 0, born, shake: 0 };
    this.applyTexture(s, true);
    this.sprites.set(b.id, s);
    return s;
  }

  private removeSprite(s: BubbleSprite): void {
    s.sprite.destroy();
    s.ring.destroy();
    s.glow?.destroy();
    this.sprites.delete(s.id);
  }

  private clearAll(): void {
    for (const s of [...this.sprites.values()]) this.removeSprite(s);
    for (const d of this.dying) d.sprite.destroy();
    this.dying = [];
    this.fx.clear();
    this.spawnAt.clear();
    this.hint = [];
    this.hintKey = '';
  }

  update(f: BoardFrame): void {
    const L = this.layout;
    if (!L) return;
    this.lastState = f.state;
    const round = f.state.round;
    const target = f.mode === 'game' && round !== null ? 1 : 0;
    this.visible += (target - this.visible) * Math.min(1, f.dt * (target > this.visible ? 5 : 3));
    if (Math.abs(target - this.visible) < 0.01) this.visible = target;
    this.panel.alpha = this.visible;
    this.layer.alpha = this.visible;
    this.root.visible = this.visible > 0.001 || this.fx.count > 0 || this.dying.length > 0;

    if (round === null) {
      if (this.sprites.size > 0 && this.visible === 0) this.clearAll();
    } else if (round !== this.roundRef) {
      this.clearAll();
      this.roundRef = round;
      this.lastActivity = f.now;
    }

    for (const e of f.events) this.onEvent(e, f);
    if (round !== null) this.sync(f);
    this.animate(f);
    this.drawLink(f);
    this.fx.update(f.dt);
  }

  private onEvent(e: GameEvent, f: BoardFrame): void {
    const L = this.layout!;
    const r = L.board.r;
    switch (e.type) {
      case 'link': {
        this.lastActivity = f.now;
        const s = this.spriteAtCell(e.cell);
        if (s && !f.reduced) {
          this.fx.spawn({ tex: this.tex.ring, x: s.x, y: s.y, life: 0.3, size0: r * 1.6, size1: r * 2.8, alpha0: 0.7, tint: BUBBLE_COLORS[e.color % 6]!.glow, add: true });
        }
        break;
      }
      case 'unlink':
        this.lastActivity = f.now;
        break;
      case 'cancel':
        this.lastActivity = f.now;
        for (const c of e.cells) {
          const s = this.spriteAtCell(c);
          if (s) s.shake = 0.35;
        }
        break;
      case 'pop': {
        this.lastActivity = f.now;
        e.cells.forEach((c, i) => this.kill(c, i * 0.035, f, 'chain'));
        if (e.made !== null && e.madeId !== null) {
          const last = e.cells[e.cells.length - 1]!;
          const at = cellCenter(L.board, last.cell);
          this.spawnAt.set(e.madeId, at);
          const tint = e.made === 'bomb' ? 0x8ff0ff : 0xfff3a0;
          this.fx.spawn({ tex: this.tex.glow, x: at.x, y: at.y, life: 0.6, delay: e.cells.length * 0.035, size0: r * 2, size1: r * 7, alpha0: 0.9, tint, add: true });
          if (!f.reduced) {
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2;
              this.fx.spawn({ tex: this.tex.spark, x: at.x, y: at.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, drag: 0.05, life: 0.7, delay: e.cells.length * 0.035, size0: r * 0.9, size1: r * 0.2, alpha0: 1, spin: 4, add: true });
            }
          }
        }
        break;
      }
      case 'burst': {
        this.lastActivity = f.now;
        const center = cellCenter(L.board, e.cell);
        const bomb = e.kind === 'bomb';
        const base = e.chained ? 0.12 : 0;
        this.fx.spawn({ tex: this.tex.glow, x: center.x, y: center.y, life: 0.55, delay: base, size0: r * 2, size1: r * (bomb ? 9 : 7), alpha0: 1, tint: bomb ? 0x9ff4ff : 0xffffff, add: true });
        this.fx.spawn({ tex: this.tex.ring, x: center.x, y: center.y, life: 0.6, delay: base, size0: r * 2, size1: r * (bomb ? 11 : 8), alpha0: 0.9, tint: bomb ? 0xbff8ff : 0xfff6b0, add: true });
        if (!bomb && !f.reduced) {
          [0xff6a8a, 0xffc24f, 0x7bf09a, 0x61d4ff, 0xb98cff].forEach((tint, k) =>
            this.fx.spawn({ tex: this.tex.ring, x: center.x, y: center.y, life: 0.7, delay: base + k * 0.06, size0: r * 2, size1: r * (5 + k * 1.2), alpha0: 0.8, tint, add: true }),
          );
        }
        e.cells.forEach((c, i) => {
          const d = bomb ? hexDistance(e.cell, c.cell, L.board.rows) * 0.06 : i * 0.02;
          this.kill(c, base + d, f, bomb ? 'bomb' : 'prism');
        });
        break;
      }
      case 'feverStart': {
        const P = L.panel;
        this.fx.spawn({ tex: this.tex.glow, x: P.x + P.w / 2, y: P.y + P.h / 2, life: 0.8, size0: P.w * 0.6, size1: P.w * 1.8, alpha0: 0.55, tint: 0xc8fff0, add: true });
        if (!f.reduced) {
          for (let k = 0; k < 36; k++) {
            this.fx.spawn({
              tex: this.tex.spark,
              x: P.x + Math.random() * P.w,
              y: P.y + Math.random() * P.h,
              vy: -40 - Math.random() * 60,
              life: 0.9 + Math.random() * 0.5,
              delay: Math.random() * 0.4,
              size0: r * (0.3 + Math.random() * 0.5),
              size1: 0,
              alpha0: 1,
              spin: 3,
              tint: [0xffffff, 0x9ffcff, 0xd4ffb0, 0xffd0f0][k % 4],
              add: true,
            });
          }
        }
        break;
      }
      case 'shuffle':
        if (!f.reduced) {
          const P = L.panel;
          for (let k = 0; k < 16; k++) {
            this.fx.spawn({ tex: this.tex.spark, x: P.x + Math.random() * P.w, y: P.y + Math.random() * P.h, life: 0.6, delay: Math.random() * 0.3, size0: r * 0.8, size1: 0, spin: 3, add: true });
          }
        }
        break;
      default:
        break;
    }
  }

  private spriteAtCell(cell: number): BubbleSprite | undefined {
    const b = this.lastState?.round?.board.cells[cell];
    return b ? this.sprites.get(b.id) : undefined;
  }

  /** 泡がはじける：ふくらんで消え、しぶきときらめきを飛ばす */
  private kill(c: PopCell, delay: number, f: BoardFrame, why: 'chain' | 'bomb' | 'prism'): void {
    const s = this.sprites.get(c.id);
    const L = this.layout!;
    const r = L.board.r;
    const at = s ? { x: s.x, y: s.y } : cellCenter(L.board, c.cell);
    if (s) {
      this.dying.push({ sprite: s.sprite, delay, age: 0, size: s.sprite.scale.x });
      s.ring.destroy();
      s.glow?.destroy();
      this.sprites.delete(c.id);
    }
    const col = BUBBLE_COLORS[c.color % BUBBLE_COLORS.length]!;
    const tint = c.kind === 'bomb' ? 0x9ff4ff : col.glow;
    this.fx.spawn({ tex: this.tex.ring, x: at.x, y: at.y, life: 0.38, delay, size0: r * 1.4, size1: r * 3.4, alpha0: 0.9, tint, add: true });
    if (f.reduced) return;
    const drops = why === 'chain' ? 6 : 4;
    for (let k = 0; k < drops; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 150;
      this.fx.spawn({
        tex: this.tex.drop,
        x: at.x,
        y: at.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        drag: 0.04,
        gravity: -60,
        life: 0.45 + Math.random() * 0.3,
        delay,
        size0: r * (0.25 + Math.random() * 0.25),
        size1: 0,
        alpha0: 1,
        tint: k % 2 === 0 ? 0xffffff : tint,
      });
    }
    this.fx.spawn({ tex: this.tex.spark, x: at.x + (Math.random() - 0.5) * r, y: at.y + (Math.random() - 0.5) * r, life: 0.5, delay: delay + 0.05, size0: r * 1.1, size1: 0, alpha0: 1, spin: 5, add: true });
  }

  /** ルール本体の盤面と泡のスプライトを合わせる */
  private sync(f: BoardFrame): void {
    const L = this.layout!;
    const B = L.board;
    const r = f.state.round!;
    const cells = r.board.cells;
    const first = this.sprites.size === 0;
    const seen = new Set<number>();
    for (let c = 0; c < B.cols; c++) {
      let fresh = 0;
      for (let row = 0; row < B.rows; row++) {
        const i = c * B.rows + row;
        const b = cells[i]!;
        seen.add(b.id);
        const s = this.sprites.get(b.id);
        if (s) {
          s.bubble = b;
          this.applyTexture(s);
          continue;
        }
        const at = cellCenter(B, i);
        const born = this.spawnAt.get(b.id);
        if (born) {
          // 長くつないで生まれた特別な泡：最後の泡の場所でぽんと現れ、列が詰まるのに合わせて動く
          this.spawnAt.delete(b.id);
          this.makeSprite(b, born.x, born.y, f.now);
        } else if (first) {
          // あそびの始まり：その場でぽんと現れる
          this.makeSprite(b, at.x, at.y, f.now + (f.reduced ? 0 : c * 0.04 + row * 0.03));
        } else {
          // 下から湧いて浮かんでくる
          const y = B.y0 + B.h + B.r + fresh * 2 * B.r;
          fresh += 1;
          this.makeSprite(b, at.x, y, f.now - 1);
        }
      }
    }
    for (const s of [...this.sprites.values()]) if (!seen.has(s.id)) this.removeSprite(s);
  }

  private animate(f: BoardFrame): void {
    const L = this.layout!;
    const B = L.board;
    const r = this.lastState?.round ?? null;
    const dt = Math.min(1 / 20, f.dt);
    const chain = r?.chain ?? [];
    const chainSet = new Set(chain);
    const chainColor = chain.length > 0 ? (r!.board.cells[chain[0]!]?.color ?? -1) : -1;
    const pressed = r?.pressed ?? null;
    const fever = (r?.feverLeft ?? 0) > 0;

    // しばらく触っていないときは、つなげる場所をそっと知らせる
    let hintSet: Set<number> | null = null;
    if (r && r.phase === 'playing' && chain.length === 0 && f.now - this.lastActivity > HINT_AFTER) {
      const key = r.board.cells.map((b) => b.id).join(',');
      if (key !== this.hintKey) {
        this.hintKey = key;
        this.hint = bestChain(r.board, f.minChain, 400);
      }
      hintSet = new Set(this.hint);
    }

    const k = 280;
    const damp = f.reduced ? 40 : 24;
    const cells = r?.board.cells ?? [];
    const cellOf = new Map<number, number>();
    cells.forEach((b, i) => cellOf.set(b.id, i));
    for (const s of this.sprites.values()) {
      const i = cellOf.get(s.id);
      if (i === undefined) continue;
      const tgt = cellCenter(B, i);
      if (f.reduced) {
        s.x = tgt.x;
        s.y = tgt.y;
      } else {
        const ax = k * (tgt.x - s.x) - damp * s.vx;
        const ay = k * (tgt.y - s.y) - damp * s.vy;
        s.vx += ax * dt;
        s.vy += ay * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      let scale = (2 * B.r) / this.px;
      const since = f.now - s.born;
      if (since < 0) scale = 0;
      else if (since < 0.32) scale *= easeOutBack(since / 0.32);
      let alpha = 1;
      let tint = 0xffffff;
      const inChain = chainSet.has(i);
      if (inChain || pressed === i) scale *= 1.13;
      else if (chain.length > 0 && (s.bubble.kind !== 'color' || s.bubble.color !== chainColor)) {
        // つなげない泡は暗く沈める（後ろが透けて見えないよう、薄くはしない）
        tint = 0x6f86a0;
        alpha = 0.9;
      }
      if (hintSet?.has(i)) scale *= 1 + 0.07 * (0.5 + 0.5 * Math.sin(f.now * 7));
      if (s.bubble.kind === 'bomb' && !f.reduced) scale *= 1 + 0.05 * Math.sin(f.now * 5 + s.id);
      let ox = 0;
      if (s.shake > 0) {
        s.shake = Math.max(0, s.shake - dt);
        ox = Math.sin(f.now * 55) * 3 * (s.shake / 0.35);
      }
      s.sprite.position.set(s.x + ox, s.y);
      s.sprite.scale.set(scale);
      s.sprite.alpha = alpha;
      s.sprite.tint = tint;
      s.sprite.rotation = s.bubble.kind === 'prism' && !f.reduced ? Math.sin(f.now * 1.5 + s.id) * 0.25 : 0;
      s.ring.visible = inChain || pressed === i;
      if (s.ring.visible) {
        s.ring.position.set(s.x + ox, s.y);
        const rs = (2 * B.r * 1.28) / 128;
        s.ring.scale.set(rs);
        s.ring.alpha = 0.85 + 0.15 * Math.sin(f.now * 10);
      }
      if (s.glow) {
        s.glow.position.set(s.x, s.y);
        const gs = (2 * B.r * (2.1 + (f.reduced ? 0 : 0.25 * Math.sin(f.now * 4 + s.id)))) / 128;
        s.glow.scale.set(gs);
        s.glow.alpha = 0.55 * alpha;
      }
      if (fever && !f.reduced && Math.random() < dt * 0.25) {
        this.fx.spawn({ tex: this.tex.spark, x: s.x + (Math.random() - 0.5) * B.r, y: s.y - B.r * 0.4, life: 0.5, size0: B.r * 0.6, size1: 0, spin: 4, add: true });
      }
    }

    const out: Dying[] = [];
    for (const d of this.dying) {
      if (d.delay > 0) {
        d.delay -= f.dt;
        out.push(d);
        continue;
      }
      d.age += f.dt;
      const t = d.age / 0.14;
      if (t >= 1) {
        d.sprite.destroy();
        continue;
      }
      d.sprite.scale.set(d.size * (1 + 0.45 * t));
      d.sprite.alpha = 1 - t;
      out.push(d);
    }
    this.dying = out;

    // エアロタイムの板の光
    const P = L.panel;
    const fg = fever ? 1 : 0;
    this.feverGlow.alpha += (fg * (0.45 + 0.15 * Math.sin(f.now * 3)) - this.feverGlow.alpha) * Math.min(1, f.dt * 4);
    this.feverGlow.position.set(P.x + P.w / 2, P.y + P.h / 2);
    this.feverGlow.width = P.w * 1.35;
    this.feverGlow.height = P.h * 1.2;
    const hue = (f.now * 0.25) % 1;
    this.feverGlow.tint = hue < 0.33 ? 0x9dfff0 : hue < 0.66 ? 0xd9b8ff : 0xb8ffc8;
  }

  private drawLink(f: BoardFrame): void {
    const r = this.lastState?.round ?? null;
    if (!r || r.chain.length === 0 || !this.layout) {
      this.link.clear();
      return;
    }
    const B = this.layout.board;
    const pts: { x: number; y: number }[] = [];
    for (const c of r.chain) {
      const b = r.board.cells[c];
      const s = b ? this.sprites.get(b.id) : undefined;
      pts.push(s ? { x: s.x, y: s.y } : cellCenter(B, c));
    }
    const color = BUBBLE_COLORS[r.board.cells[r.chain[0]!]!.color % 6]!;
    const last = pts[pts.length - 1]!;
    const tail = pointer.active && Math.hypot(pointer.x - last.x, pointer.y - last.y) > B.r * 0.6 ? { x: pointer.x, y: pointer.y } : null;
    this.link.draw(pts, tail, B.r, color.glow, r.chain.length >= f.minChain);
  }

  /** テスト用：描いている泡の数など */
  stats(): { sprites: number; visibleSprites: number; dying: number; fx: number; alpha: number } {
    let vis = 0;
    for (const s of this.sprites.values()) if (s.sprite.visible && s.sprite.alpha > 0.05 && s.sprite.scale.x > 0.05) vis += 1;
    return { sprites: this.sprites.size, visibleSprites: vis, dying: this.dying.length, fx: this.fx.count, alpha: this.layer.alpha };
  }

  destroy(): void {
    this.clearAll();
    this.bag.destroy();
    this.root.destroy({ children: true });
  }
}
