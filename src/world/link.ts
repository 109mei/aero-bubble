import { Container, Sprite, type Texture } from 'pixi.js';

/**
 * 指でつないだ線。線は、ふちをぼかした帯の絵を伸ばして並べる
 * （アンチエイリアスなしでもなめらかで、GPU のない端末でも軽い）。
 */

interface Pt {
  x: number;
  y: number;
}

class Pool {
  private list: Sprite[] = [];
  private used = 0;

  constructor(
    private readonly parent: Container,
    private readonly tex: Texture,
    private readonly anchorX: number,
  ) {}

  begin(): void {
    this.used = 0;
  }

  next(): Sprite {
    let s = this.list[this.used];
    if (!s) {
      s = new Sprite(this.tex);
      s.anchor.set(this.anchorX, 0.5);
      this.parent.addChild(s);
      this.list.push(s);
    }
    this.used += 1;
    s.visible = true;
    return s;
  }

  end(): void {
    for (let i = this.used; i < this.list.length; i++) this.list[i]!.visible = false;
  }
}

export class LinkView {
  readonly root = new Container();
  private readonly glowLayer = new Container();
  private readonly coreLayer = new Container();
  private readonly dotLayer = new Container();
  private readonly glowSegs: Pool;
  private readonly coreSegs: Pool;
  private readonly dots: Pool;

  constructor(beam: Texture, dot: Texture) {
    this.root.addChild(this.glowLayer, this.coreLayer, this.dotLayer);
    this.glowSegs = new Pool(this.glowLayer, beam, 0);
    this.coreSegs = new Pool(this.coreLayer, beam, 0);
    this.dots = new Pool(this.dotLayer, dot, 0.5);
  }

  private segment(pool: Pool, a: Pt, b: Pt, thick: number, tint: number, alpha: number): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const s = pool.next();
    // 両端を太さの半分だけのばして、つなぎ目のすき間をなくす
    const ext = thick * 0.35;
    const ux = dx / len;
    const uy = dy / len;
    s.position.set(a.x - ux * ext, a.y - uy * ext);
    s.rotation = Math.atan2(dy, dx);
    s.width = len + ext * 2;
    s.height = thick;
    s.tint = tint;
    s.alpha = alpha;
  }

  private dot(p: Pt, size: number, tint: number, alpha: number): void {
    const s = this.dots.next();
    s.position.set(p.x, p.y);
    s.width = size;
    s.height = size;
    s.tint = tint;
    s.alpha = alpha;
  }

  /** points：つないだ泡の中心、tail：指の位置（線の先）、r：泡の半径 */
  draw(points: Pt[], tail: Pt | null, r: number, glow: number, enough: boolean): void {
    this.glowSegs.begin();
    this.coreSegs.begin();
    this.dots.begin();
    for (let i = 1; i < points.length; i++) {
      this.segment(this.glowSegs, points[i - 1]!, points[i]!, r * 0.8, glow, 0.6);
      this.segment(this.coreSegs, points[i - 1]!, points[i]!, r * 0.34, 0xffffff, 1);
    }
    const last = points[points.length - 1];
    if (last && tail) this.segment(this.coreSegs, last, tail, r * 0.22, 0xffffff, 0.6);
    for (const p of points) this.dot(p, r * 0.36, 0xffffff, 1);
    if (last) this.dot(last, r * (enough ? 0.62 : 0.46), enough ? 0xffffff : glow, 1);
    this.glowSegs.end();
    this.coreSegs.end();
    this.dots.end();
  }

  clear(): void {
    this.draw([], null, 1, 0xffffff, false);
  }
}
