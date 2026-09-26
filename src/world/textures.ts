import { CanvasSource, Texture } from 'pixi.js';
import { makeCanvas, type Ctx } from './art/color';

/** Canvas2D で描いた絵を PixiJS のテクスチャにする（全体の Cache には入れず、要らなくなったら destroy する） */
export function canvasTexture(w: number, h: number, paint: (ctx: Ctx, w: number, h: number) => void): Texture {
  const { canvas, ctx } = makeCanvas(w, h);
  paint(ctx, canvas.width, canvas.height);
  return new Texture({ source: new CanvasSource({ resource: canvas }) });
}

/** 大きさごとに作り直すテクスチャの入れ物 */
export class TextureBag {
  private map = new Map<string, Texture>();

  get(key: string, make: () => Texture): Texture {
    const hit = this.map.get(key);
    if (hit) return hit;
    const t = make();
    this.map.set(key, t);
    return t;
  }

  /** 頭の文字が prefix の物を捨てる（大きさが変わったとき） */
  drop(prefix: string): void {
    for (const [k, t] of this.map) {
      if (k.startsWith(prefix)) {
        t.destroy(true);
        this.map.delete(k);
      }
    }
  }

  destroy(): void {
    for (const t of this.map.values()) t.destroy(true);
    this.map.clear();
  }
}
