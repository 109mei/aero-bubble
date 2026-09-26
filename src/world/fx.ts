import { Container, Sprite, type Texture } from 'pixi.js';

/**
 * しぶき・きらめき・光の輪（使い回すスプライトの粒）。座標は基準の画面のピクセル。
 */

export interface ParticleSpec {
  tex: Texture;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  /** 秒 */
  life: number;
  delay?: number;
  /** 見た目の大きさ（直径） */
  size0: number;
  size1: number;
  alpha0?: number;
  alpha1?: number;
  tint?: number;
  spin?: number;
  rotation?: number;
  /** 速さの減り（1秒あたりに残る割合） */
  drag?: number;
  /** 上向きの浮力（負で上へ） */
  gravity?: number;
  add?: boolean;
}

interface Particle extends Required<Omit<ParticleSpec, 'tex'>> {
  sprite: Sprite;
  age: number;
}

export class Fx {
  readonly root = new Container();
  readonly addRoot = new Container();
  private live: Particle[] = [];
  private pool: Sprite[] = [];
  private readonly max: number;

  constructor(max = 420) {
    this.max = max;
    this.addRoot.blendMode = 'add';
  }

  spawn(p: ParticleSpec): void {
    if (this.live.length >= this.max) return;
    const sprite = this.pool.pop() ?? new Sprite();
    sprite.texture = p.tex;
    sprite.anchor.set(0.5);
    sprite.visible = false;
    (p.add ? this.addRoot : this.root).addChild(sprite);
    this.live.push({
      sprite,
      age: 0,
      x: p.x,
      y: p.y,
      vx: p.vx ?? 0,
      vy: p.vy ?? 0,
      life: p.life,
      delay: p.delay ?? 0,
      size0: p.size0,
      size1: p.size1,
      alpha0: p.alpha0 ?? 1,
      alpha1: p.alpha1 ?? 0,
      tint: p.tint ?? 0xffffff,
      spin: p.spin ?? 0,
      rotation: p.rotation ?? 0,
      drag: p.drag ?? 1,
      gravity: p.gravity ?? 0,
      add: p.add ?? false,
    });
  }

  update(dt: number): void {
    const out: Particle[] = [];
    for (const p of this.live) {
      if (p.delay > 0) {
        p.delay -= dt;
        out.push(p);
        continue;
      }
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.sprite.visible = false;
        p.sprite.removeFromParent();
        this.pool.push(p.sprite);
        continue;
      }
      const k = Math.pow(p.drag, dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
      const e = 1 - (1 - t) * (1 - t);
      const size = p.size0 + (p.size1 - p.size0) * e;
      const s = p.sprite;
      s.visible = true;
      s.position.set(p.x, p.y);
      s.width = size;
      s.height = size;
      s.rotation = p.rotation;
      s.alpha = p.alpha0 + (p.alpha1 - p.alpha0) * t;
      s.tint = p.tint;
      out.push(p);
    }
    this.live = out;
  }

  get count(): number {
    return this.live.length;
  }

  clear(): void {
    for (const p of this.live) {
      p.sprite.visible = false;
      p.sprite.removeFromParent();
      this.pool.push(p.sprite);
    }
    this.live = [];
  }
}
