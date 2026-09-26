import { artRandom, rgba, type Ctx } from './color';

/**
 * 景色の絵（Canvas2D）：空・太陽・レンズの光・雲・丘・水・光の筋・海の底・虹・地球・風車・オーロラ・ガラスの板。
 * フルティガーエアロの「晴れた空とつややかな水」を描く。
 */

/** 空の色（上が濃い青、地平線に向かって白く明るく） */
export function paintSky(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0A6FD8');
  g.addColorStop(0.35, '#2F9BEE');
  g.addColorStop(0.72, '#8FD8FF');
  g.addColorStop(1, '#E4F8FF');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** 水の色（水面の近くは明るい青緑、深くなるほど濃い青） */
export function paintWater(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7FE6F8');
  g.addColorStop(0.08, '#3CC6EE');
  g.addColorStop(0.45, '#1591DB');
  g.addColorStop(0.8, '#0A62B4');
  g.addColorStop(1, '#07468E');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** 太陽の光（白い芯とあたたかい光の広がり） */
export function paintSun(ctx: Ctx, S: number): void {
  const c = S / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.07, 'rgba(255,255,250,1)');
  g.addColorStop(0.13, 'rgba(255,250,215,0.85)');
  g.addColorStop(0.32, 'rgba(255,244,200,0.32)');
  g.addColorStop(0.6, 'rgba(255,240,210,0.1)');
  g.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // 光の筋
  ctx.save();
  ctx.translate(c, c);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    ctx.rotate((Math.PI * 2) / 12);
    const len = c * (i % 2 === 0 ? 0.95 : 0.6);
    const lg = ctx.createLinearGradient(0, 0, len, 0);
    lg.addColorStop(0, 'rgba(255,255,240,0.35)');
    lg.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(0, -c * 0.02);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, c * 0.02);
    ctx.fill();
  }
  ctx.restore();
}

/** レンズの光の輪（加算で重ねる） */
export function paintFlare(ctx: Ctx, S: number, color: string, ring: boolean): void {
  const c = S / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  if (ring) {
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.72, rgba(color, 0.12));
    g.addColorStop(0.9, rgba(color, 0.55));
    g.addColorStop(1, rgba(color, 0));
  } else {
    g.addColorStop(0, rgba(color, 0.55));
    g.addColorStop(0.7, rgba(color, 0.3));
    g.addColorStop(1, rgba(color, 0));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
}

/** ふわふわの雲（丸をいくつも重ね、下を少し青くかげらせる） */
export function paintCloud(ctx: Ctx, w: number, h: number, seed: number): void {
  const rnd = artRandom(seed);
  const puffs: [number, number, number][] = [];
  const n = 7 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = w * (0.16 + 0.68 * t + (rnd() - 0.5) * 0.08);
    const bump = Math.sin(t * Math.PI);
    const r = h * (0.2 + 0.2 * bump + rnd() * 0.08);
    const y = h * (0.66 - 0.2 * bump + (rnd() - 0.5) * 0.08);
    puffs.push([x, y, r]);
  }
  for (const [x, y, r] of puffs) {
    const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.96)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const shade = ctx.createLinearGradient(0, h * 0.35, 0, h);
  shade.addColorStop(0, 'rgba(170,205,240,0)');
  shade.addColorStop(1, 'rgba(150,190,235,0.55)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** なだらかな緑の丘（奥はかすみ、手前はつやのある緑） */
export function paintHills(ctx: Ctx, w: number, h: number): void {
  const layer = (top: number, amp: number, phase: number, c1: string, c2: string, shine: boolean) => {
    ctx.beginPath();
    ctx.moveTo(0, h);
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * w;
      const y = h * top - amp * h * (0.55 * Math.sin((i / steps) * Math.PI * 1.3 + phase) + 0.45 * Math.sin((i / steps) * Math.PI * 2.7 + phase * 1.7));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, h * (top - amp), 0, h);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fill();
    if (shine) {
      ctx.save();
      ctx.clip();
      const s = ctx.createLinearGradient(0, h * (top - amp), 0, h * (top + 0.15));
      s.addColorStop(0, 'rgba(255,255,220,0.45)');
      s.addColorStop(1, 'rgba(255,255,220,0)');
      ctx.fillStyle = s;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  };
  layer(0.42, 0.22, 0.4, '#A9E3B4', '#7CC99A', false);
  layer(0.62, 0.2, 2.1, '#8EE05A', '#46A93A', true);
  layer(0.82, 0.14, 4.0, '#6DD447', '#2F8F2A', true);
}

/** 水の中に差しこむ光の筋（縦に長い、白い帯） */
export function paintRay(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(0,0,0,1)');
  v.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

/** 水面のきらめく帯 */
export function paintSurface(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(230,255,255,0.55)');
  g.addColorStop(1, 'rgba(200,250,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** 海の底：砂の起伏・光る小石・海藻・サンゴ */
export function paintSeabed(ctx: Ctx, w: number, h: number, seed: number): void {
  const rnd = artRandom(seed);
  // 奥の砂
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= 40; i++) {
    const x = (i / 40) * w;
    ctx.lineTo(x, h * (0.45 + 0.12 * Math.sin(i * 0.5) + 0.05 * Math.sin(i * 1.7)));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  const g1 = ctx.createLinearGradient(0, h * 0.3, 0, h);
  g1.addColorStop(0, 'rgba(236,222,170,0.75)');
  g1.addColorStop(1, 'rgba(196,168,110,0.9)');
  ctx.fillStyle = g1;
  ctx.fill();
  // サンゴと海藻（奥）
  const coral = ['#FF7FA8', '#FFB067', '#C58CFF'];
  for (let i = 0; i < 5; i++) {
    const x = w * (0.05 + 0.9 * rnd());
    const base = h * (0.62 + rnd() * 0.1);
    const col = coral[i % coral.length]!;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      ctx.lineWidth = h * (0.05 - k * 0.008);
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.quadraticCurveTo(x + (rnd() - 0.5) * h * 0.4, base - h * 0.2, x + (rnd() - 0.5) * h * 0.5, base - h * (0.25 + rnd() * 0.25));
      ctx.stroke();
    }
  }
  // 手前の砂
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= 40; i++) {
    const x = (i / 40) * w;
    ctx.lineTo(x, h * (0.68 + 0.08 * Math.sin(i * 0.37 + 1) + 0.04 * Math.sin(i * 1.3)));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  const g2 = ctx.createLinearGradient(0, h * 0.55, 0, h);
  g2.addColorStop(0, '#F8EBC0');
  g2.addColorStop(1, '#D9B879');
  ctx.fillStyle = g2;
  ctx.fill();
  // 光る小石
  for (let i = 0; i < 16; i++) {
    const x = w * rnd();
    const y = h * (0.8 + rnd() * 0.17);
    const r = h * (0.025 + rnd() * 0.035);
    const cols = ['#9EE7FF', '#FFFFFF', '#B8F5C8', '#FFD6E8'];
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(1, cols[i % cols.length]!);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 海藻の1本（下が根元。揺らすのは PixiJS 側） */
export function paintWeed(ctx: Ctx, w: number, h: number, hue: 'green' | 'teal'): void {
  const c1 = hue === 'green' ? '#7BE36A' : '#5FE0C6';
  const c2 = hue === 'green' ? '#2E9E3F' : '#1E9C8C';
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, c2);
  g.addColorStop(0.5, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h);
  ctx.bezierCurveTo(w * 0.1, h * 0.7, w * 0.9, h * 0.45, w * 0.45, h * 0.05);
  ctx.quadraticCurveTo(w * 0.5, 0, w * 0.6, h * 0.08);
  ctx.bezierCurveTo(w * 1.0, h * 0.45, w * 0.3, h * 0.7, w * 0.65, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = w * 0.06;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.95);
  ctx.bezierCurveTo(w * 0.3, h * 0.7, w * 0.8, h * 0.45, w * 0.52, h * 0.1);
  ctx.stroke();
}

/** 虹（半円の7色） */
export function paintRainbow(ctx: Ctx, w: number, h: number): void {
  const cols = ['#FF5A6E', '#FF9F43', '#FFE45C', '#6BE38A', '#4FC8FF', '#6F7CFF', '#B77BFF'];
  const cx = w / 2;
  const cy = h;
  const outer = Math.min(w / 2, h) * 0.98;
  const band = outer * 0.055;
  cols.forEach((col, i) => {
    ctx.beginPath();
    ctx.arc(cx, cy, outer - i * band - band / 2, Math.PI, 0);
    ctx.strokeStyle = rgba(col, 0.55);
    ctx.lineWidth = band * 1.05;
    ctx.stroke();
  });
  // ふちをぼかす白い光
  ctx.beginPath();
  ctx.arc(cx, cy, outer - band * 3.5, Math.PI, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = band * 8;
  ctx.stroke();
}

/** つやのある地球 */
export function paintEarth(ctx: Ctx, S: number): void {
  const c = S / 2;
  const r = S * 0.4;
  // 大気の光
  const atm = ctx.createRadialGradient(c, c, r * 0.9, c, c, r * 1.25);
  atm.addColorStop(0, 'rgba(160,230,255,0.7)');
  atm.addColorStop(1, 'rgba(160,230,255,0)');
  ctx.fillStyle = atm;
  ctx.fillRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.clip();
  const sea = ctx.createRadialGradient(c - r * 0.35, c - r * 0.35, r * 0.1, c, c, r);
  sea.addColorStop(0, '#6FD6FF');
  sea.addColorStop(0.55, '#1C86E0');
  sea.addColorStop(1, '#0B3F9C');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, S, S);
  // 大陸（でこぼこのある、なめらかなかたまり。点の間を中点でつないで角を丸める）
  const land = (cx: number, cy: number, rx: number, ry: number, seed: number, col1: string, col2: string) => {
    const rnd = artRandom(seed);
    const n = 14;
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 0.62 + rnd() * 0.5;
      pts.push([c + (cx + Math.cos(a) * rx * k) * r, c + (cy + Math.sin(a) * ry * k) * r]);
    }
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const p = pts[i % n]!;
      const q = pts[(i + 1) % n]!;
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(p[0], p[1], mx, my);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(c - r, c - r, c + r, c + r);
    g.addColorStop(0, col1);
    g.addColorStop(1, col2);
    ctx.fillStyle = g;
    ctx.fill();
  };
  land(-0.42, -0.18, 0.42, 0.55, 3, '#9BEA70', '#2E9E3F');
  land(0.5, 0.2, 0.3, 0.42, 8, '#A6EE7A', '#3AA846');
  land(-0.05, 0.72, 0.3, 0.14, 13, '#B5F28A', '#4DB356');
  // うすい雲（やわらかな白い帯）
  for (const [x, y, rx, ry] of [
    [-0.35, 0.3, 0.3, 0.07],
    [0.3, -0.45, 0.28, 0.06],
    [0.55, 0.62, 0.22, 0.05],
  ] as const) {
    const g = ctx.createRadialGradient(c + x * r, c + y * r, 0, c + x * r, c + y * r, rx * r);
    g.addColorStop(0, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(c + x * r, c + y * r, rx * r, ry * r * 1.6, -0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  // 夜の側のかげ
  const shade = ctx.createRadialGradient(c - r * 0.5, c - r * 0.5, r * 0.4, c, c, r * 1.25);
  shade.addColorStop(0, 'rgba(0,20,60,0)');
  shade.addColorStop(1, 'rgba(0,20,60,0.55)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
  // つや
  ctx.beginPath();
  ctx.ellipse(c - r * 0.1, c - r * 0.5, r * 0.62, r * 0.36, -0.2, 0, Math.PI * 2);
  const gl = ctx.createLinearGradient(0, c - r * 0.9, 0, c - r * 0.1);
  gl.addColorStop(0, 'rgba(255,255,255,0.8)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.fill();
}

/** 風車の塔（羽根は paintBlades を回して重ねる） */
export function paintTurbineTower(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#C9D8E6');
  g.addColorStop(0.45, '#FFFFFF');
  g.addColorStop(1, '#AFC2D6');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.08);
  ctx.lineTo(w * 0.58, h * 0.08);
  ctx.lineTo(w * 0.66, h);
  ctx.lineTo(w * 0.34, h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.08, w * 0.22, w * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function paintBlades(ctx: Ctx, S: number): void {
  const c = S / 2;
  ctx.translate(c, c);
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    const g = ctx.createLinearGradient(-S * 0.03, 0, S * 0.03, 0);
    g.addColorStop(0, '#DCE8F2');
    g.addColorStop(0.5, '#FFFFFF');
    g.addColorStop(1, '#C3D3E3');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-S * 0.025, 0);
    ctx.quadraticCurveTo(-S * 0.045, -c * 0.5, 0, -c * 0.98);
    ctx.quadraticCurveTo(S * 0.03, -c * 0.5, S * 0.025, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 0, S * 0.045, 0, Math.PI * 2);
  ctx.fill();
}

/** オーロラの帯（縦に垂れるカーテン。加算で重ねる） */
export function paintAurora(ctx: Ctx, w: number, h: number, c1: string, c2: string, seed: number): void {
  const rnd = artRandom(seed);
  const cols = 60;
  const colW = w / cols;
  for (let i = 0; i < cols; i++) {
    const t = i / cols;
    const top = h * (0.15 + 0.2 * Math.sin(t * Math.PI * 2.2 + seed) + 0.08 * rnd());
    const len = h * (0.45 + 0.25 * Math.sin(t * Math.PI * 3.1 + seed * 2));
    const g = ctx.createLinearGradient(0, top, 0, top + len);
    g.addColorStop(0, rgba(c2, 0));
    g.addColorStop(0.25, rgba(c2, 0.5));
    g.addColorStop(0.6, rgba(c1, 0.55));
    g.addColorStop(1, rgba(c1, 0));
    ctx.fillStyle = g;
    ctx.fillRect(i * colW, top, colW + 1, len);
  }
}

/** 泡の盤面を置くガラスの板（Aero のウィンドウ） */
export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function paintPanel(ctx: Ctx, w: number, h: number, radius: number): void {
  const round = (inset: number) => roundRectPath(ctx, inset, inset, w - inset * 2, h - inset * 2, Math.max(0, radius - inset));
  // 影
  ctx.save();
  ctx.shadowColor = 'rgba(0,40,110,0.35)';
  ctx.shadowBlur = radius * 0.6;
  ctx.shadowOffsetY = radius * 0.15;
  round(radius * 0.3);
  ctx.fillStyle = 'rgba(0,60,140,0.2)';
  ctx.fill();
  ctx.restore();
  // ガラス
  round(radius * 0.3);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.42)');
  g.addColorStop(0.08, 'rgba(210,245,255,0.24)');
  g.addColorStop(1, 'rgba(160,220,255,0.16)');
  ctx.fillStyle = g;
  ctx.fill();
  // 上半分のつや
  ctx.save();
  round(radius * 0.3);
  ctx.clip();
  const shine = ctx.createLinearGradient(0, 0, 0, radius * 2.2);
  shine.addColorStop(0, 'rgba(255,255,255,0.55)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, w, radius * 2.2);
  // 斜めの光
  ctx.globalCompositeOperation = 'lighter';
  const diag = ctx.createLinearGradient(0, 0, w, h * 0.6);
  diag.addColorStop(0, 'rgba(255,255,255,0)');
  diag.addColorStop(0.18, 'rgba(255,255,255,0.1)');
  diag.addColorStop(0.24, 'rgba(255,255,255,0)');
  ctx.fillStyle = diag;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // ふち
  ctx.lineWidth = Math.max(1.5, radius * 0.08);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  round(radius * 0.3 + ctx.lineWidth / 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,70,150,0.35)';
  round(radius * 0.3);
  ctx.stroke();
}
