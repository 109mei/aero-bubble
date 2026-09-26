/**
 * 画面の寸法。幅 390 を基準に端末の幅へ合わせて拡大縮小し、高さは端末に合わせて伸び縮みさせる
 * （スマホのブラウザは縦の長さがまちまちなので、盤面が横いっぱいに使えるようにする）。
 * 数値の単位は「基準の画面のピクセル」。PixiJS（world）と React（ui）の両方が使う。DOM も PixiJS も知らない。
 */

export const BASE_W = 390;
/** これより低い画面では、高さに合わせて縮める */
export const MIN_H = 620;
/** これより高い画面では、上下の余りを海と空に回す */
export const MAX_H = 960;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardGeom {
  cols: number;
  rows: number;
  /** 盤面の左上（泡の外形を囲む四角） */
  x0: number;
  y0: number;
  /** 泡の半径 */
  r: number;
  /** 列の間隔（r×√3） */
  dx: number;
  w: number;
  h: number;
}

export interface Layout {
  /** 画面（CSS ピクセル） */
  vw: number;
  vh: number;
  /** 基準のピクセル → CSS ピクセル */
  scale: number;
  /** 基準の画面の大きさ */
  frameW: number;
  frameH: number;
  /** 基準の画面の左上（CSS ピクセル） */
  offsetX: number;
  offsetY: number;
  /** 切り欠き・ホームバーの余白（基準のピクセル） */
  safeTop: number;
  safeBottom: number;
  hud: Rect;
  gauge: Rect;
  /** 泡の盤面を置くガラスの板 */
  panel: Rect;
  board: BoardGeom;
  /** 水面の高さ：あそんでいるとき・タイトル */
  surfaceGame: number;
  surfaceTitle: number;
}

const SQRT3 = Math.sqrt(3);

export function computeLayout(vw: number, vh: number, insetTop: number, insetBottom: number, cols: number, rows: number): Layout {
  const w = Math.max(1, vw);
  const h = Math.max(1, vh);
  let scale = w / BASE_W;
  let frameH = h / scale;
  if (frameH < MIN_H) {
    scale = h / MIN_H;
    frameH = MIN_H;
  }
  frameH = Math.min(frameH, MAX_H);
  const offsetX = (w - BASE_W * scale) / 2;
  const offsetY = (h - frameH * scale) / 2;
  const safeTop = Math.min(60, insetTop / scale);
  const safeBottom = Math.min(40, insetBottom / scale);

  const hud: Rect = { x: 12, y: safeTop + 6, w: BASE_W - 24, h: 76 };
  const gauge: Rect = { x: 22, y: hud.y + hud.h + 4, w: BASE_W - 44, h: 26 };
  const surfaceGame = gauge.y + gauge.h + 12;
  const panelTop = surfaceGame + 14;
  const panelBottom = frameH - safeBottom - 10;
  const panel: Rect = { x: 8, y: panelTop, w: BASE_W - 16, h: Math.max(200, panelBottom - panelTop) };

  const pad = 10;
  const r = Math.min((panel.w - 2 * pad) / (2 + (cols - 1) * SQRT3), (panel.h - 2 * pad) / (2 * rows + 1));
  const bw = r * (2 + (cols - 1) * SQRT3);
  const bh = r * (2 * rows + 1);
  // 盤面はガラスの板の下に寄せる（指が届きやすく、上の空いた水に仲間が泳ぐ）
  const board: BoardGeom = {
    cols,
    rows,
    x0: panel.x + (panel.w - bw) / 2,
    y0: panel.y + panel.h - pad - bh,
    r,
    dx: r * SQRT3,
    w: bw,
    h: bh,
  };
  // 板の上が空きすぎるときは、板を盤面に合わせて縮める
  const spare = board.y0 - pad - panel.y;
  if (spare > 0) {
    panel.y += spare;
    panel.h -= spare;
  }
  const surfaceTitle = Math.max(safeTop + 250, frameH * 0.42);
  return { vw: w, vh: h, scale, frameW: BASE_W, frameH, offsetX, offsetY, safeTop, safeBottom, hud, gauge, panel, board, surfaceGame, surfaceTitle };
}

export function cellCenter(b: BoardGeom, cell: number): { x: number; y: number } {
  const c = Math.floor(cell / b.rows);
  const row = cell % b.rows;
  return { x: b.x0 + b.r + c * b.dx, y: b.y0 + b.r + row * 2 * b.r + (c % 2 === 1 ? b.r : 0) };
}

/** 基準の座標 (x, y) にいちばん近い泡のマス。泡の半径 × factor より遠ければ -1 */
export function hitCell(b: BoardGeom, x: number, y: number, factor: number): number {
  const c0 = Math.round((x - b.x0 - b.r) / b.dx);
  let best = -1;
  let bestD = (b.r * factor) ** 2;
  for (let c = c0 - 1; c <= c0 + 1; c++) {
    if (c < 0 || c >= b.cols) continue;
    const off = c % 2 === 1 ? b.r : 0;
    const r0 = Math.round((y - b.y0 - b.r - off) / (2 * b.r));
    for (let row = r0 - 1; row <= r0 + 1; row++) {
      if (row < 0 || row >= b.rows) continue;
      const cx = b.x0 + b.r + c * b.dx;
      const cy = b.y0 + b.r + row * 2 * b.r + off;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = c * b.rows + row;
      }
    }
  }
  return best;
}

/** CSS ピクセルの座標を基準の座標にする */
export function toBase(l: Layout, clientX: number, clientY: number): { x: number; y: number } {
  return { x: (clientX - l.offsetX) / l.scale, y: (clientY - l.offsetY) / l.scale };
}

/** 基準の座標を CSS ピクセルにする */
export function toClient(l: Layout, x: number, y: number): { x: number; y: number } {
  return { x: l.offsetX + x * l.scale, y: l.offsetY + y * l.scale };
}
