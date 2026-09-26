import { BUBBLE_COLORS, rgba, type BubbleColor, type Ctx, type IconKind } from './color';

/**
 * 泡の絵（Canvas2D）。つやのあるガラス玉：下からの照り返し・上の大きなハイライト・白いふち。
 * 大きさ S の正方形のまんなかに描く。
 */

function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** 印（白）を (0,0) を中心に大きさ s で描く */
export function drawIcon(ctx: Ctx, icon: IconKind, s: number, accent: string): void {
  ctx.beginPath();
  switch (icon) {
    case 'drop':
      ctx.moveTo(0, -0.5 * s);
      ctx.bezierCurveTo(0.16 * s, -0.26 * s, 0.37 * s, -0.04 * s, 0.37 * s, 0.14 * s);
      ctx.arc(0, 0.14 * s, 0.37 * s, 0, Math.PI, false);
      ctx.bezierCurveTo(-0.37 * s, -0.04 * s, -0.16 * s, -0.26 * s, 0, -0.5 * s);
      ctx.fill();
      // しずくの中の小さな光
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(-0.13 * s, 0.1 * s, 0.07 * s, 0.13 * s, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'leaf': {
      ctx.save();
      ctx.rotate(-0.72);
      ctx.moveTo(-0.5 * s, 0);
      ctx.quadraticCurveTo(-0.02 * s, -0.46 * s, 0.5 * s, 0);
      ctx.quadraticCurveTo(-0.02 * s, 0.46 * s, -0.5 * s, 0);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 0.06 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-0.4 * s, 0);
      ctx.lineTo(0.36 * s, 0);
      for (const k of [-0.18, 0.02, 0.2]) {
        ctx.moveTo(k * s, 0);
        ctx.lineTo((k + 0.12) * s, -0.13 * s);
        ctx.moveTo(k * s, 0);
        ctx.lineTo((k + 0.12) * s, 0.13 * s);
      }
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'sun': {
      circle(ctx, 0, 0, 0.21 * s);
      ctx.fill();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 0.09 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.moveTo(Math.cos(a) * 0.31 * s, Math.sin(a) * 0.31 * s);
        ctx.lineTo(Math.cos(a) * 0.45 * s, Math.sin(a) * 0.45 * s);
      }
      ctx.stroke();
      break;
    }
    case 'flower': {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        circle(ctx, Math.cos(a) * 0.23 * s, Math.sin(a) * 0.23 * s, 0.18 * s);
        ctx.fill();
      }
      ctx.fillStyle = accent;
      circle(ctx, 0, 0, 0.12 * s);
      ctx.fill();
      break;
    }
    case 'star': {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = (i % 2 === 0 ? 0.5 : 0.22) * s;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 0.08 * s;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'heart': {
      ctx.moveTo(0, 0.42 * s);
      ctx.bezierCurveTo(-0.52 * s, 0.05 * s, -0.42 * s, -0.46 * s, 0, -0.18 * s);
      ctx.bezierCurveTo(0.42 * s, -0.46 * s, 0.52 * s, 0.05 * s, 0, 0.42 * s);
      ctx.fill();
      break;
    }
  }
}

/** つやのある上のハイライトと、左上の小さな光 */
function gloss(ctx: Ctx, cx: number, cy: number, r: number, strength = 1): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.47, r * 0.68, r * 0.4, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(0, cy - r * 0.88, 0, cy - r * 0.07);
  g.addColorStop(0, `rgba(255,255,255,${0.92 * strength})`);
  g.addColorStop(0.55, `rgba(255,255,255,${0.35 * strength})`);
  g.addColorStop(1, 'rgba(255,255,255,0.02)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${0.95 * strength})`;
  circle(ctx, cx - r * 0.5, cy - r * 0.34, r * 0.075);
  ctx.fill();
  ctx.restore();
}

/** ふつうの色の泡 */
export function paintBubble(ctx: Ctx, S: number, c: BubbleColor): void {
  const cx = S / 2;
  const cy = S / 2;
  const r = S * 0.47;
  ctx.save();
  // 体：左上から光が当たったガラス玉
  const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.05, cx, cy + r * 0.05, r * 1.02);
  body.addColorStop(0, c.light);
  body.addColorStop(0.4, c.base);
  body.addColorStop(0.8, c.dark);
  body.addColorStop(1, c.deep);
  ctx.fillStyle = body;
  circle(ctx, cx, cy, r);
  ctx.fill();
  // 下からの照り返し（光が玉の中を通って下にたまる）
  ctx.save();
  circle(ctx, cx, cy, r);
  ctx.clip();
  const low = ctx.createRadialGradient(cx, cy + r * 0.95, r * 0.05, cx, cy + r * 0.7, r * 0.78);
  low.addColorStop(0, rgba(c.light, 0.95));
  low.addColorStop(0.5, rgba(c.light, 0.35));
  low.addColorStop(1, rgba(c.light, 0));
  ctx.fillStyle = low;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
  // 印
  ctx.save();
  ctx.translate(cx, cy + r * 0.06);
  ctx.shadowColor = rgba(c.deep, 0.6);
  ctx.shadowBlur = r * 0.12;
  ctx.shadowOffsetY = r * 0.05;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  drawIcon(ctx, c.icon, r * 1.0, rgba(c.base, 0.9));
  ctx.restore();
  gloss(ctx, cx, cy, r);
  // ふち：外は濃い線（となりの泡と分ける）、内は白い光
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.strokeStyle = rgba(c.deep, 0.55);
  circle(ctx, cx, cy, r - ctx.lineWidth / 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  circle(ctx, cx, cy, r * 0.9);
  ctx.stroke();
  ctx.restore();
}

/** アクアボム：水のうずを閉じこめた透きとおる玉 */
export function paintBomb(ctx: Ctx, S: number): void {
  const cx = S / 2;
  const cy = S / 2;
  const r = S * 0.47;
  ctx.save();
  const body = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.02, cx, cy, r);
  body.addColorStop(0, '#FFFFFF');
  body.addColorStop(0.28, '#C9F7FF');
  body.addColorStop(0.62, '#34C6F4');
  body.addColorStop(0.9, '#0B78D0');
  body.addColorStop(1, '#064F9C');
  ctx.fillStyle = body;
  circle(ctx, cx, cy, r);
  ctx.fill();
  // うず
  ctx.save();
  circle(ctx, cx, cy, r * 0.96);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    for (let t = 0; t <= 1.001; t += 0.05) {
      const a = t * Math.PI * 1.25;
      const rr = r * (0.18 + 0.62 * t);
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = r * 0.1;
    ctx.stroke();
  }
  ctx.restore();
  // まんなかの光
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.42);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  circle(ctx, cx, cy, r * 0.42);
  ctx.fill();
  // 中の小さな泡
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, r * 0.035);
  for (const [dx, dy, rr] of [
    [0.42, 0.3, 0.1],
    [-0.36, 0.42, 0.08],
    [0.1, 0.55, 0.06],
    [-0.5, 0.05, 0.05],
  ] as const) {
    circle(ctx, cx + dx * r, cy + dy * r, rr * r);
    ctx.stroke();
  }
  gloss(ctx, cx, cy, r);
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.strokeStyle = 'rgba(232,253,255,0.95)';
  circle(ctx, cx, cy, r - ctx.lineWidth / 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.strokeStyle = 'rgba(6,79,156,0.8)';
  circle(ctx, cx, cy, r - ctx.lineWidth / 2);
  ctx.stroke();
  ctx.restore();
}

/** プリズム：虹色の玉。つないだ色の輪と印で、どの色を消すかがわかる */
export function paintPrism(ctx: Ctx, S: number, c: BubbleColor): void {
  const cx = S / 2;
  const cy = S / 2;
  const r = S * 0.47;
  ctx.save();
  circle(ctx, cx, cy, r);
  ctx.clip();
  const stops = ['#FF5A7A', '#FFB23F', '#FFF06A', '#6CF08A', '#4FD8FF', '#6C8CFF', '#C77DFF', '#FF5A7A'];
  if (typeof ctx.createConicGradient === 'function') {
    const cg = ctx.createConicGradient(-Math.PI / 2, cx, cy);
    stops.forEach((s, i) => cg.addColorStop(i / (stops.length - 1), s));
    ctx.fillStyle = cg;
  } else {
    const lg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    stops.forEach((s, i) => lg.addColorStop(i / (stops.length - 1), s));
    ctx.fillStyle = lg;
  }
  ctx.fillRect(0, 0, S, S);
  const soft = ctx.createRadialGradient(cx - r * 0.1, cy - r * 0.1, 0, cx, cy, r);
  soft.addColorStop(0, 'rgba(255,255,255,0.9)');
  soft.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  soft.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = soft;
  ctx.fillRect(0, 0, S, S);
  const edge = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
  edge.addColorStop(0, 'rgba(40,20,120,0)');
  edge.addColorStop(1, 'rgba(40,20,120,0.35)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
  // つないだ色の輪
  ctx.save();
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = c.base;
  circle(ctx, cx, cy, r * 0.8);
  ctx.stroke();
  ctx.lineWidth = r * 0.04;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  circle(ctx, cx, cy, r * 0.8 - r * 0.08);
  ctx.stroke();
  // 印
  ctx.translate(cx, cy + r * 0.04);
  ctx.shadowColor = rgba(c.deep, 0.7);
  ctx.shadowBlur = r * 0.14;
  ctx.fillStyle = '#FFFFFF';
  drawIcon(ctx, c.icon, r * 0.78, rgba(c.base, 0.95));
  ctx.restore();
  gloss(ctx, cx, cy, r);
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  circle(ctx, cx, cy, r - ctx.lineWidth / 2);
  ctx.stroke();
}

/** やわらかい光の玉（白。PixiJS で色を付けて使う） */
export function paintGlow(ctx: Ctx, S: number): void {
  const c = S / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
}

/** 泡のまわりの光の輪（つないでいる泡に重ねる） */
export function paintRing(ctx: Ctx, S: number, width: number): void {
  const c = S / 2;
  const r = c - width;
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = width * 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = width;
  circle(ctx, c, c, r);
  ctx.stroke();
  ctx.restore();
}

/** はじけたしぶき（白い小さな玉） */
export function paintDroplet(ctx: Ctx, S: number): void {
  const c = S / 2;
  const g = ctx.createRadialGradient(c - S * 0.12, c - S * 0.12, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  circle(ctx, c, c, c);
  ctx.fill();
}

/** 4つの光の筋のきらめき */
export function paintSparkle(ctx: Ctx, S: number): void {
  const c = S / 2;
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c * 0.5);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(c, 0);
  ctx.quadraticCurveTo(c + S * 0.06, c - S * 0.06, S, c);
  ctx.quadraticCurveTo(c + S * 0.06, c + S * 0.06, c, S);
  ctx.quadraticCurveTo(c - S * 0.06, c + S * 0.06, 0, c);
  ctx.quadraticCurveTo(c - S * 0.06, c - S * 0.06, c, 0);
  ctx.fill();
}

/** 水の中の小さな泡（まわりを飾る） */
export function paintAirBubble(ctx: Ctx, S: number): void {
  const c = S / 2;
  const r = S * 0.44;
  const g = ctx.createRadialGradient(c, c + r * 0.3, 0, c, c, r);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0.55)');
  ctx.fillStyle = g;
  circle(ctx, c, c, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, S * 0.05);
  circle(ctx, c, c, r);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(c - r * 0.35, c - r * 0.4, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

export { BUBBLE_COLORS };
