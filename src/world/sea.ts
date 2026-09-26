import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { paintAirBubble } from './art/bubbles';
import { CREATURE_ART } from './art/creatures';
import {
  paintAurora,
  paintBlades,
  paintCloud,
  paintEarth,
  paintFlare,
  paintHills,
  paintRainbow,
  paintRay,
  paintSeabed,
  paintSky,
  paintSun,
  paintSurface,
  paintTurbineTower,
  paintWater,
  paintWeed,
} from './art/scenery';
import type { Layout } from './layout';
import { canvasTexture, TextureBag } from './textures';

/**
 * 空と海の景色（画面いっぱい、CSS ピクセルの座標）。水面の高さ surf より上が空、下が海。
 * アクアリウムの仲間（生き物・虹・風車・地球）もここで描く。
 */

export interface SeaFrame {
  layout: Layout;
  /** 水面の高さ（基準のピクセル） */
  surface: number;
  /** 経った時間（秒）と前のフレームからの秒数 */
  now: number;
  dt: number;
  reduced: boolean;
  /** エアロタイムの強さ（0〜1） */
  fever: number;
  unlocked: ReadonlySet<string>;
}

interface Swimmer {
  kind: string;
  sprite: Sprite;
  /** 基準のピクセルでの大きさ */
  w: number;
  h: number;
  speed: number;
  dir: 1 | -1;
  x: number;
  /** 水の中の高さ（0 が水面、1 が底） */
  depth: number;
  amp: number;
  phase: number;
  bob: number;
  /** 群れの先頭からのずれ */
  lead?: Swimmer;
  offX?: number;
  offY?: number;
}

interface CreatureSpec {
  kind: string;
  count: number;
  w: number;
  speed: number;
  depth: [number, number];
  alpha: number;
}

/** 水槽の仲間の泳ぎ方（大きさは基準のピクセル） */
const CREATURES: CreatureSpec[] = [
  { kind: 'whale', count: 1, w: 250, speed: 11, depth: [0.35, 0.6], alpha: 0.72 },
  { kind: 'manta', count: 1, w: 120, speed: 24, depth: [0.3, 0.7], alpha: 0.9 },
  { kind: 'turtle', count: 1, w: 88, speed: 15, depth: [0.2, 0.8], alpha: 0.95 },
  { kind: 'dolphin', count: 1, w: 118, speed: 52, depth: [0.08, 0.4], alpha: 0.95 },
  { kind: 'jellyfish', count: 2, w: 40, speed: 6, depth: [0.15, 0.75], alpha: 0.9 },
  { kind: 'goldfish', count: 2, w: 58, speed: 24, depth: [0.15, 0.85], alpha: 1 },
  { kind: 'clownfish', count: 2, w: 52, speed: 30, depth: [0.55, 0.92], alpha: 1 },
  { kind: 'tetra', count: 7, w: 30, speed: 44, depth: [0.2, 0.7], alpha: 1 },
];

export class Sea {
  readonly root = new Container();
  private readonly bag = new TextureBag();
  private readonly sky = new Sprite();
  private readonly sun = new Sprite();
  private readonly rainbow = new Sprite();
  private readonly clouds: Sprite[] = [];
  private readonly cloudX: number[] = [];
  private readonly earth = new Sprite();
  private readonly auroras: Sprite[] = [];
  /** エアロタイムに水の中へ差しこむオーロラの光 */
  private readonly waterAuroras: Sprite[] = [];
  private readonly hills = new Sprite();
  private readonly towers: Sprite[] = [];
  private readonly blades: Sprite[] = [];
  private readonly water = new Sprite();
  private readonly rays: Sprite[] = [];
  private readonly creatureLayer = new Container();
  private readonly airLayer = new Container();
  private readonly air: { sprite: Sprite; x: number; y: number; size: number; speed: number; phase: number }[] = [];
  private readonly seabed = new Sprite();
  private readonly weeds: Sprite[] = [];
  private readonly surfaceBand = new Sprite();
  private readonly surfaceLine = new Graphics();
  private readonly flares: Sprite[] = [];
  private readonly swimmers: Swimmer[] = [];
  private shownKinds = '';
  private sizeKey = '';
  private layout: Layout | null = null;
  private res = 1;

  constructor() {
    const b = this.bag;
    this.sky.texture = b.get('sky', () => canvasTexture(4, 512, (c, w, h) => paintSky(c, w, h)));
    this.water.texture = b.get('water', () => canvasTexture(4, 512, (c, w, h) => paintWater(c, w, h)));
    this.sun.texture = b.get('sun', () => canvasTexture(512, 512, (c, w) => paintSun(c, w)));
    this.sun.anchor.set(0.5);
    this.sun.blendMode = 'add';
    this.rainbow.texture = b.get('rainbow', () => canvasTexture(1024, 512, (c, w, h) => paintRainbow(c, w, h)));
    this.rainbow.anchor.set(0.5, 1);
    this.earth.texture = b.get('earth', () => canvasTexture(256, 256, (c, w) => paintEarth(c, w)));
    this.earth.anchor.set(0.5);
    for (let i = 0; i < 5; i++) {
      const tex = b.get(`cloud${i % 3}`, () => canvasTexture(512, 224, (c, w, h) => paintCloud(c, w, h, 11 + (i % 3) * 7)));
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      this.clouds.push(s);
      this.cloudX.push(Math.random());
    }
    const auroraCols: [string, string][] = [
      ['#39FFB0', '#7CF7FF'],
      ['#B57BFF', '#FF8FE0'],
    ];
    auroraCols.forEach(([c1, c2], i) => {
      const tex = b.get(`aurora${i}`, () => canvasTexture(512, 256, (c, w, h) => paintAurora(c, w, h, c1, c2, i * 3 + 1)));
      const s = new Sprite(tex);
      s.blendMode = 'add';
      s.alpha = 0;
      this.auroras.push(s);
      const w = new Sprite(tex);
      w.blendMode = 'add';
      w.alpha = 0;
      this.waterAuroras.push(w);
    });
    this.hills.anchor.set(0, 1);
    for (let i = 0; i < 3; i++) {
      const t = new Sprite(b.get('tower', () => canvasTexture(64, 256, (c, w, h) => paintTurbineTower(c, w, h))));
      t.anchor.set(0.5, 1);
      const bl = new Sprite(b.get('blades', () => canvasTexture(256, 256, (c, w) => paintBlades(c, w))));
      bl.anchor.set(0.5);
      this.towers.push(t);
      this.blades.push(bl);
    }
    const rayTex = b.get('ray', () => canvasTexture(128, 512, (c, w, h) => paintRay(c, w, h)));
    for (let i = 0; i < 5; i++) {
      const s = new Sprite(rayTex);
      s.anchor.set(0.5, 0);
      s.blendMode = 'add';
      this.rays.push(s);
    }
    const airTex = b.get('air', () => canvasTexture(64, 64, (c, w) => paintAirBubble(c, w)));
    for (let i = 0; i < 22; i++) {
      const s = new Sprite(airTex);
      s.anchor.set(0.5);
      const big = i < 5;
      this.air.push({ sprite: s, x: Math.random(), y: Math.random(), size: big ? 26 + Math.random() * 30 : 5 + Math.random() * 12, speed: big ? 14 : 24 + Math.random() * 30, phase: Math.random() * 6.28 });
      this.airLayer.addChild(s);
    }
    this.seabed.anchor.set(0, 1);
    for (let i = 0; i < 7; i++) {
      const s = new Sprite(b.get(`weed${i % 2}`, () => canvasTexture(64, 256, (c, w, h) => paintWeed(c, w, h, i % 2 === 0 ? 'green' : 'teal'))));
      s.anchor.set(0.5, 1);
      this.weeds.push(s);
    }
    this.surfaceBand.texture = b.get('surface', () => canvasTexture(4, 64, (c, w, h) => paintSurface(c, w, h)));
    this.surfaceBand.blendMode = 'add';
    const flareCols = ['#8FFFE0', '#9FB8FF', '#FFFFFF', '#C6FF9F'];
    flareCols.forEach((col, i) => {
      const s = new Sprite(b.get(`flare${i}`, () => canvasTexture(128, 128, (c, w) => paintFlare(c, w, col, i === 3))));
      s.anchor.set(0.5);
      s.blendMode = 'add';
      this.flares.push(s);
    });

    this.root.addChild(this.sky, this.sun, this.rainbow, ...this.clouds, this.earth, ...this.auroras, this.hills);
    this.towers.forEach((t, i) => this.root.addChild(t, this.blades[i]!));
    this.root.addChild(this.water, ...this.rays, ...this.waterAuroras, this.creatureLayer, this.airLayer, this.seabed, ...this.weeds, this.surfaceBand, this.surfaceLine, ...this.flares);
  }

  /** 画面の大きさが変わったら、大きさに合わせた絵を描き直す */
  resize(layout: Layout, res: number): void {
    this.layout = layout;
    this.res = res;
    const key = `${Math.round(layout.vw)}x${Math.round(layout.vh)}@${layout.scale.toFixed(3)}x${res}`;
    if (key === this.sizeKey) return;
    this.sizeKey = key;
    this.bag.drop('size:');
    const pw = Math.ceil(layout.vw * res);
    const hillH = 70 * layout.scale;
    this.hills.texture = this.bag.get('size:hills', () => canvasTexture(pw, Math.ceil(hillH * res), (c, w, h) => paintHills(c, w, h)));
    const bedH = 100 * layout.scale;
    this.seabed.texture = this.bag.get('size:seabed', () => canvasTexture(pw, Math.ceil(bedH * res), (c, w, h) => paintSeabed(c, w, h, 5)));
    // 生き物は大きさに合わせて描き直す
    for (const s of this.swimmers) s.sprite.texture = this.creatureTexture(s.kind, s.w);
  }

  private creatureTexture(kind: string, w: number): Texture {
    const art = CREATURE_ART[kind]!;
    const scale = this.layout?.scale ?? 1;
    const pw = Math.max(8, Math.ceil(w * scale * this.res));
    const ph = Math.max(8, Math.ceil(pw / art.aspect));
    return this.bag.get(`size:creature:${kind}:${pw}`, () => canvasTexture(pw, ph, (c, cw, ch) => art.paint(c, cw, ch)));
  }

  private syncCreatures(unlocked: ReadonlySet<string>): void {
    const kinds = CREATURES.filter((c) => unlocked.has(c.kind))
      .map((c) => c.kind)
      .join(',');
    if (kinds === this.shownKinds) return;
    this.shownKinds = kinds;
    for (const s of this.swimmers) s.sprite.destroy();
    this.swimmers.length = 0;
    for (const spec of CREATURES) {
      if (!unlocked.has(spec.kind)) continue;
      let lead: Swimmer | undefined;
      for (let i = 0; i < spec.count; i++) {
        const sprite = new Sprite(this.creatureTexture(spec.kind, spec.w));
        sprite.anchor.set(0.5);
        sprite.alpha = spec.alpha;
        const s: Swimmer = {
          kind: spec.kind,
          sprite,
          w: spec.w,
          h: spec.w / CREATURE_ART[spec.kind]!.aspect,
          speed: spec.speed * (0.85 + Math.random() * 0.3),
          dir: Math.random() < 0.5 ? 1 : -1,
          x: Math.random(),
          depth: spec.depth[0] + Math.random() * (spec.depth[1] - spec.depth[0]),
          amp: spec.kind === 'jellyfish' ? 26 : 6 + Math.random() * 6,
          phase: Math.random() * Math.PI * 2,
          bob: spec.kind === 'jellyfish' ? 0.5 : 1.2 + Math.random() * 0.8,
        };
        if (spec.kind === 'tetra') {
          if (lead === undefined) lead = s;
          else {
            s.lead = lead;
            s.offX = -(i % 3) * 26 - Math.floor(i / 3) * 10 + Math.random() * 6;
            s.offY = ((i % 3) - 1) * 16 + (Math.floor(i / 3) - 1) * 8;
          }
        }
        this.swimmers.push(s);
        this.creatureLayer.addChild(sprite);
      }
    }
  }

  update(f: SeaFrame): void {
    const L = f.layout;
    if (this.layout !== L) this.resize(L, this.res);
    const { vw, vh, scale, offsetX, offsetY } = L;
    const sx = (x: number) => offsetX + x * scale;
    const sy = (y: number) => offsetY + y * scale;
    const surf = sy(f.surface);
    const t = f.reduced ? 0 : f.now;
    const skyH = Math.max(1, surf + 4);

    this.sky.position.set(0, 0);
    this.sky.width = vw;
    this.sky.height = skyH;

    // 太陽とレンズの光
    const sunX = sx(322);
    const sunY = Math.min(sy(L.safeTop + 30), surf - 20 * scale);
    this.sun.position.set(sunX, sunY);
    const sunSize = 330 * scale * (1 + 0.03 * Math.sin(t * 0.8));
    this.sun.width = sunSize;
    this.sun.height = sunSize;
    const fx0 = sunX;
    const fy0 = sunY;
    const fx1 = vw * 0.25;
    const fy1 = surf + (vh - surf) * 0.35;
    const flareAt = [0.3, 0.52, 0.66, 0.9];
    const flareSize = [46, 80, 22, 84];
    const flareAlpha = [0.55, 0.5, 0.6, 0.22];
    this.flares.forEach((s, i) => {
      s.position.set(fx0 + (fx1 - fx0) * flareAt[i]!, fy0 + (fy1 - fy0) * flareAt[i]!);
      const sz = flareSize[i]! * scale;
      s.width = sz;
      s.height = sz;
      s.alpha = flareAlpha[i]! + 0.1 * Math.sin(t * 0.7 + i);
    });

    // 虹・雲・地球
    this.rainbow.visible = f.unlocked.has('rainbow');
    if (this.rainbow.visible) {
      this.rainbow.position.set(vw * 0.46, surf + 24 * scale);
      this.rainbow.width = 560 * scale;
      this.rainbow.height = 280 * scale;
      this.rainbow.alpha = 0.85;
    }
    const skyTop = sy(L.safeTop);
    const skySpan = Math.max(30 * scale, surf - skyTop - 26 * scale);
    this.clouds.forEach((c, i) => {
      this.cloudX[i] = (this.cloudX[i]! + f.dt * (0.004 + i * 0.0015) * (f.reduced ? 0 : 1)) % 1;
      const w = (150 + (i % 3) * 40) * scale * Math.min(1.25, Math.max(0.8, skySpan / (180 * scale)));
      c.width = w;
      c.height = w * (224 / 512);
      c.position.set(-w / 2 + this.cloudX[i]! * (vw + w), skyTop + ((i * 0.37) % 1) * skySpan * 0.9 + 18 * scale);
      c.alpha = 0.95;
    });
    this.earth.visible = f.unlocked.has('earth');
    if (this.earth.visible) {
      const es = 92 * scale;
      this.earth.width = es;
      this.earth.height = es;
      this.earth.position.set(sx(62), Math.min(sy(L.safeTop + 58), surf - 60 * scale) + Math.sin(t * 0.6) * 3 * scale);
      this.earth.rotation = Math.sin(t * 0.2) * 0.05;
    }

    // オーロラ（エアロタイム）
    this.auroras.forEach((a, i) => {
      a.alpha = f.fever * (0.75 - i * 0.15);
      a.visible = a.alpha > 0.01;
      if (!a.visible) return;
      const w = vw * 1.4;
      a.width = w;
      a.height = skyH * 1.05;
      a.position.set(-vw * 0.2 + Math.sin(t * (0.35 + i * 0.2) + i) * vw * 0.12, -skyH * 0.05 + Math.sin(t * 0.9 + i) * 6 * scale);
    });

    // 丘と風車
    this.hills.position.set(0, surf + 3 * scale);
    this.hills.width = vw;
    this.hills.height = 70 * scale;
    const turbines = f.unlocked.has('turbine');
    const towerX = [vw * 0.64, vw * 0.76, vw * 0.87];
    const towerH = [62, 50, 40];
    const towerBase = [surf - 30 * scale, surf - 22 * scale, surf - 16 * scale];
    this.towers.forEach((tw, i) => {
      tw.visible = turbines;
      this.blades[i]!.visible = turbines;
      if (!turbines) return;
      const h = towerH[i]! * scale;
      tw.height = h;
      tw.width = h / 4;
      tw.position.set(towerX[i]!, towerBase[i]!);
      const bl = this.blades[i]!;
      bl.width = h * 0.95;
      bl.height = h * 0.95;
      bl.position.set(towerX[i]!, towerBase[i]! - h + h * 0.08);
      bl.rotation = t * (1.1 + i * 0.25);
    });

    // 水
    this.water.position.set(0, surf);
    this.water.width = vw;
    this.water.height = Math.max(1, vh - surf);
    const waterH = vh - surf;
    this.rays.forEach((r, i) => {
      const x = vw * (0.1 + i * 0.22) + Math.sin(t * 0.3 + i * 1.7) * 18 * scale;
      r.position.set(x, surf);
      r.width = (70 + (i % 3) * 30) * scale;
      r.height = waterH * 0.9;
      r.rotation = 0.22 + Math.sin(t * 0.25 + i) * 0.05;
      r.alpha = (0.1 + 0.07 * Math.sin(t * 0.6 + i * 2.1)) * (1 + f.fever * 0.8);
    });

    this.waterAuroras.forEach((a, i) => {
      a.alpha = f.fever * (0.42 - i * 0.1);
      a.visible = a.alpha > 0.01;
      if (!a.visible) return;
      a.width = vw * 1.5;
      a.height = waterH * 1.1;
      a.position.set(-vw * 0.25 + Math.sin(t * (0.3 + i * 0.25) + i * 2) * vw * 0.15, surf - waterH * 0.08);
    });

    this.syncCreatures(f.unlocked);
    const top = surf + 30 * scale;
    const bottom = vh - 60 * scale;
    for (const s of this.swimmers) this.swim(s, f, top, bottom, vw, scale, t);

    const airTop = surf + 6 * scale;
    for (const a of this.air) {
      if (!f.reduced) a.y -= (a.speed * scale * f.dt) / Math.max(1, vh - airTop);
      if (a.y < 0) {
        a.y = 1;
        a.x = Math.random();
      }
      const size = a.size * scale;
      a.sprite.width = size;
      a.sprite.height = size;
      a.sprite.position.set(a.x * vw + Math.sin(t * 1.3 + a.phase) * 6 * scale, airTop + a.y * (vh - airTop));
      a.sprite.alpha = Math.min(1, a.y * 6) * 0.8;
    }

    this.seabed.position.set(0, vh);
    this.seabed.width = vw;
    this.seabed.height = 100 * scale;
    this.weeds.forEach((w, i) => {
      const h = (70 + ((i * 37) % 50)) * scale;
      w.height = h;
      w.width = h / 4;
      w.position.set(vw * (0.04 + i * 0.155) + ((i * 13) % 20) * scale, vh - 14 * scale);
      w.rotation = Math.sin(t * 0.9 + i * 1.3) * 0.12;
    });

    this.surfaceBand.position.set(0, surf - 10 * scale);
    this.surfaceBand.width = vw;
    this.surfaceBand.height = 26 * scale;
    const g = this.surfaceLine;
    g.clear();
    const step = 12;
    g.moveTo(0, surf);
    for (let x = 0; x <= vw + step; x += step) {
      g.lineTo(x, surf + Math.sin(x * 0.03 + t * 2.2) * 2 * scale + Math.sin(x * 0.011 - t * 1.3) * 1.5 * scale);
    }
    g.stroke({ width: Math.max(1.5, 2.2 * scale), color: 0xffffff, alpha: 0.85 });
  }

  private swim(s: Swimmer, f: SeaFrame, top: number, bottom: number, vw: number, scale: number, t: number): void {
    const span = Math.max(1, bottom - top);
    const lead = s.lead;
    if (lead) {
      s.dir = lead.dir;
      s.x = lead.x + ((s.offX ?? 0) * scale * lead.dir) / vw;
    } else if (!f.reduced) {
      s.x += (s.dir * s.speed * scale * f.dt) / vw;
      const margin = (s.w * scale) / vw;
      if (s.dir > 0 && s.x > 1 + margin) {
        s.dir = -1;
        s.depth = 0.15 + Math.random() * 0.7;
      } else if (s.dir < 0 && s.x < -margin) {
        s.dir = 1;
        s.depth = 0.15 + Math.random() * 0.7;
      }
    }
    const depth = lead ? lead.depth : s.depth;
    let y = top + depth * span + Math.sin(t * s.bob + s.phase) * s.amp * scale;
    if (lead) y += (s.offY ?? 0) * scale;
    const w = s.w * scale;
    const h = s.h * scale;
    const tex = s.sprite.texture;
    let sy = h / tex.height;
    if (s.kind === 'jellyfish') sy *= 1 + 0.08 * Math.sin(t * 2.4 + s.phase);
    if (s.kind === 'manta') sy *= 0.85 + 0.15 * Math.sin(t * 1.6 + s.phase);
    s.sprite.scale.set((s.dir * w) / tex.width, sy);
    s.sprite.position.set(s.x * vw, y);
    s.sprite.rotation = s.kind === 'jellyfish' ? Math.sin(t * 0.7 + s.phase) * 0.08 : Math.cos(t * s.bob + s.phase) * 0.06 * s.dir;
  }

  destroy(): void {
    this.bag.destroy();
    this.root.destroy({ children: true });
  }
}
