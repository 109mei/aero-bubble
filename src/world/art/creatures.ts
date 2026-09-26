import type { Ctx } from './color';
import { paintBlades, paintEarth, paintRainbow, paintTurbineTower } from './scenery';

/**
 * アクアリウムの仲間の絵（Canvas2D）。どれも右向きで、w×h の箱いっぱいに描く。
 * 描画（PixiJS）とアクアリウムのカード（React の canvas）の両方で使う。
 */

function eye(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#10223A';
  ctx.beginPath();
  ctx.arc(x + r * 0.15, y + r * 0.05, r * 0.66, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x - r * 0.1, y - r * 0.25, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function shine(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, a: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(x, y - ry, x, y + ry);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function goldfish(ctx: Ctx, w: number, h: number): void {
  const fin = ctx.createLinearGradient(w * 0.02, 0, w * 0.4, 0);
  fin.addColorStop(0, 'rgba(255,226,180,0.8)');
  fin.addColorStop(1, 'rgba(255,128,40,0.95)');
  ctx.fillStyle = fin;
  ctx.beginPath();
  ctx.moveTo(w * 0.4, h * 0.5);
  ctx.bezierCurveTo(w * 0.24, h * 0.28, w * 0.1, h * 0.02, w * 0.02, h * 0.1);
  ctx.bezierCurveTo(w * 0.1, h * 0.3, w * 0.1, h * 0.42, w * 0.17, h * 0.5);
  ctx.bezierCurveTo(w * 0.1, h * 0.58, w * 0.1, h * 0.7, w * 0.02, h * 0.9);
  ctx.bezierCurveTo(w * 0.1, h * 0.98, w * 0.24, h * 0.72, w * 0.4, h * 0.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,220,0.7)';
  ctx.lineWidth = h * 0.02;
  for (const t of [0.25, 0.5, 0.75]) {
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.5);
    ctx.quadraticCurveTo(w * 0.2, h * (0.5 + (t - 0.5) * 0.6), w * 0.06, h * (0.1 + t * 0.8));
    ctx.stroke();
  }
  // 背びれ
  ctx.fillStyle = fin;
  ctx.beginPath();
  ctx.moveTo(w * 0.46, h * 0.26);
  ctx.quadraticCurveTo(w * 0.52, h * 0.0, w * 0.72, h * 0.22);
  ctx.closePath();
  ctx.fill();
  // 体
  const body = ctx.createRadialGradient(w * 0.55, h * 0.36, h * 0.02, w * 0.6, h * 0.5, w * 0.32);
  body.addColorStop(0, '#FFE6A8');
  body.addColorStop(0.45, '#FF9236');
  body.addColorStop(0.85, '#F05510');
  body.addColorStop(1, '#C53C08');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(w * 0.6, h * 0.5, w * 0.28, h * 0.31, 0, 0, Math.PI * 2);
  ctx.fill();
  // 胸びれ
  ctx.fillStyle = 'rgba(255,214,150,0.85)';
  ctx.beginPath();
  ctx.ellipse(w * 0.6, h * 0.68, w * 0.07, h * 0.1, 0.9, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, w * 0.77, h * 0.43, h * 0.08);
  ctx.strokeStyle = '#B43A06';
  ctx.lineWidth = h * 0.025;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(w * 0.83, h * 0.55, h * 0.05, 0.2, 1.6);
  ctx.stroke();
  shine(ctx, w * 0.6, h * 0.33, w * 0.17, h * 0.08, -0.05, 0.6);
}

function clownfish(ctx: Ctx, w: number, h: number): void {
  const edge = '#1B1B24';
  const orange = ctx.createRadialGradient(w * 0.5, h * 0.35, h * 0.05, w * 0.55, h * 0.5, w * 0.4);
  orange.addColorStop(0, '#FFC76A');
  orange.addColorStop(0.5, '#FF8A1C');
  orange.addColorStop(1, '#DD4E08');
  // 尾びれ
  ctx.fillStyle = orange;
  ctx.strokeStyle = edge;
  ctx.lineWidth = h * 0.04;
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.5);
  ctx.quadraticCurveTo(w * 0.06, h * 0.12, w * 0.03, h * 0.3);
  ctx.quadraticCurveTo(w * 0.0, h * 0.5, w * 0.03, h * 0.7);
  ctx.quadraticCurveTo(w * 0.06, h * 0.88, w * 0.24, h * 0.5);
  ctx.fill();
  ctx.stroke();
  // 背びれ
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h * 0.24);
  ctx.quadraticCurveTo(w * 0.5, h * 0.0, w * 0.7, h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 体
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(w * 0.55, h * 0.5, w * 0.36, h * 0.33, 0, 0, Math.PI * 2);
  ctx.fillStyle = orange;
  ctx.fill();
  ctx.clip();
  for (const x of [0.76, 0.52, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(w * (x - 0.04), 0);
    ctx.quadraticCurveTo(w * (x + 0.05), h * 0.5, w * (x - 0.04), h);
    ctx.lineTo(w * (x + 0.06), h);
    ctx.quadraticCurveTo(w * (x + 0.15), h * 0.5, w * (x + 0.06), 0);
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = h * 0.035;
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = edge;
  ctx.lineWidth = h * 0.03;
  ctx.beginPath();
  ctx.ellipse(w * 0.55, h * 0.5, w * 0.36, h * 0.33, 0, 0, Math.PI * 2);
  ctx.stroke();
  // 胸びれ
  ctx.fillStyle = '#FF9A2E';
  ctx.beginPath();
  ctx.ellipse(w * 0.62, h * 0.66, w * 0.06, h * 0.1, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  eye(ctx, w * 0.8, h * 0.44, h * 0.08);
  shine(ctx, w * 0.56, h * 0.3, w * 0.2, h * 0.07, 0, 0.55);
}

function tetra(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = 'rgba(210,230,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.5);
  ctx.lineTo(w * 0.0, h * 0.18);
  ctx.lineTo(w * 0.05, h * 0.5);
  ctx.lineTo(w * 0.0, h * 0.82);
  ctx.closePath();
  ctx.fill();
  const body = ctx.createLinearGradient(0, h * 0.15, 0, h * 0.85);
  body.addColorStop(0, '#CFE3FF');
  body.addColorStop(1, '#F4F8FF');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(w * 0.52, h * 0.5, w * 0.4, h * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  // 赤いところ
  ctx.fillStyle = 'rgba(255,58,92,0.95)';
  ctx.beginPath();
  ctx.ellipse(w * 0.4, h * 0.64, w * 0.25, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // 光るしま
  ctx.save();
  ctx.shadowColor = 'rgba(80,240,255,1)';
  ctx.shadowBlur = h * 0.5;
  ctx.strokeStyle = '#3FF3FF';
  ctx.lineWidth = h * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.43);
  ctx.quadraticCurveTo(w * 0.5, h * 0.36, w * 0.82, h * 0.42);
  ctx.stroke();
  ctx.restore();
  eye(ctx, w * 0.84, h * 0.47, h * 0.12);
}

function jellyfish(ctx: Ctx, w: number, h: number): void {
  // 触手
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const x = w * (0.2 + i * 0.12);
    ctx.strokeStyle = 'rgba(255,190,235,0.7)';
    ctx.lineWidth = w * 0.022;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.42);
    ctx.bezierCurveTo(x + w * 0.08, h * 0.58, x - w * 0.08, h * 0.74, x + w * 0.03, h * (0.9 + (i % 2) * 0.08));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,150,215,0.8)';
  ctx.lineWidth = w * 0.07;
  for (const x of [0.42, 0.58]) {
    ctx.beginPath();
    ctx.moveTo(w * x, h * 0.42);
    ctx.bezierCurveTo(w * (x - 0.1), h * 0.55, w * (x + 0.1), h * 0.66, w * (x - 0.02), h * 0.8);
    ctx.stroke();
  }
  // かさ
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.42);
  ctx.bezierCurveTo(w * 0.04, h * 0.0, w * 0.96, h * 0.0, w * 0.94, h * 0.42);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x1 = w * (0.94 - (0.88 * (i + 1)) / n);
    const xm = (w * (0.94 - (0.88 * i) / n) + x1) / 2;
    ctx.quadraticCurveTo(xm, h * 0.49, x1, h * 0.42);
  }
  ctx.closePath();
  const bell = ctx.createRadialGradient(w * 0.42, h * 0.16, w * 0.02, w * 0.5, h * 0.28, w * 0.55);
  bell.addColorStop(0, 'rgba(255,255,255,0.95)');
  bell.addColorStop(0.35, 'rgba(255,190,232,0.85)');
  bell.addColorStop(0.75, 'rgba(255,110,200,0.7)');
  bell.addColorStop(1, 'rgba(190,90,230,0.6)');
  ctx.fillStyle = bell;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = w * 0.02;
  ctx.stroke();
  // 中の模様
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.ellipse(w * 0.5 + Math.cos(a) * w * 0.1, h * 0.26 + Math.sin(a) * h * 0.05, w * 0.07, h * 0.035, a, 0, Math.PI * 2);
    ctx.fill();
  }
  shine(ctx, w * 0.36, h * 0.14, w * 0.18, h * 0.06, -0.5, 0.75);
}

function dolphin(ctx: Ctx, w: number, h: number): void {
  const top = '#3F78C0';
  // 尾びれ
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(w * 0.13, h * 0.49);
  ctx.quadraticCurveTo(w * 0.05, h * 0.36, w * 0.0, h * 0.26);
  ctx.quadraticCurveTo(w * 0.07, h * 0.44, w * 0.04, h * 0.52);
  ctx.quadraticCurveTo(w * 0.07, h * 0.6, w * 0.0, h * 0.76);
  ctx.quadraticCurveTo(w * 0.07, h * 0.64, w * 0.13, h * 0.54);
  ctx.fill();
  // 背びれ
  ctx.beginPath();
  ctx.moveTo(w * 0.52, h * 0.26);
  ctx.quadraticCurveTo(w * 0.46, h * 0.0, w * 0.36, h * 0.05);
  ctx.quadraticCurveTo(w * 0.42, h * 0.18, w * 0.4, h * 0.3);
  ctx.fill();
  // 体
  ctx.beginPath();
  ctx.moveTo(w * 0.98, h * 0.55);
  ctx.quadraticCurveTo(w * 0.88, h * 0.42, w * 0.8, h * 0.36);
  ctx.bezierCurveTo(w * 0.62, h * 0.16, w * 0.36, h * 0.22, w * 0.18, h * 0.44);
  ctx.lineTo(w * 0.1, h * 0.51);
  ctx.bezierCurveTo(w * 0.22, h * 0.64, w * 0.52, h * 0.76, w * 0.8, h * 0.63);
  ctx.quadraticCurveTo(w * 0.92, h * 0.59, w * 0.98, h * 0.55);
  ctx.closePath();
  const body = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.74);
  body.addColorStop(0, '#3C73BD');
  body.addColorStop(0.45, '#7DB2EA');
  body.addColorStop(0.62, '#D6EBFF');
  body.addColorStop(1, '#F4FAFF');
  ctx.fillStyle = body;
  ctx.fill();
  // 胸びれ
  ctx.fillStyle = '#5A90CF';
  ctx.beginPath();
  ctx.moveTo(w * 0.64, h * 0.62);
  ctx.quadraticCurveTo(w * 0.6, h * 0.86, w * 0.48, h * 0.9);
  ctx.quadraticCurveTo(w * 0.55, h * 0.74, w * 0.57, h * 0.63);
  ctx.fill();
  eye(ctx, w * 0.81, h * 0.46, h * 0.05);
  ctx.strokeStyle = 'rgba(40,80,140,0.7)';
  ctx.lineWidth = h * 0.02;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.9, h * 0.57);
  ctx.quadraticCurveTo(w * 0.85, h * 0.6, w * 0.8, h * 0.58);
  ctx.stroke();
  shine(ctx, w * 0.55, h * 0.3, w * 0.22, h * 0.05, -0.12, 0.6);
}

function turtle(ctx: Ctx, w: number, h: number): void {
  const skin = ctx.createLinearGradient(0, 0, 0, h);
  skin.addColorStop(0, '#C9EB94');
  skin.addColorStop(1, '#7FB356');
  ctx.fillStyle = skin;
  // うしろのひれ
  ctx.beginPath();
  ctx.ellipse(w * 0.18, h * 0.72, w * 0.08, h * 0.08, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.2, h * 0.27, w * 0.08, h * 0.07, -0.6, 0, Math.PI * 2);
  ctx.fill();
  // 前のひれ
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.64);
  ctx.quadraticCurveTo(w * 0.66, h * 0.98, w * 0.38, h * 0.99);
  ctx.quadraticCurveTo(w * 0.5, h * 0.82, w * 0.5, h * 0.64);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.32);
  ctx.quadraticCurveTo(w * 0.66, h * 0.04, w * 0.42, h * 0.02);
  ctx.quadraticCurveTo(w * 0.52, h * 0.18, w * 0.5, h * 0.34);
  ctx.fill();
  // 頭
  ctx.beginPath();
  ctx.ellipse(w * 0.86, h * 0.5, w * 0.11, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, w * 0.9, h * 0.44, h * 0.045);
  // こうら
  const shell = ctx.createRadialGradient(w * 0.42, h * 0.32, h * 0.05, w * 0.47, h * 0.5, w * 0.36);
  shell.addColorStop(0, '#B2F07E');
  shell.addColorStop(0.55, '#55A83E');
  shell.addColorStop(1, '#2B6B2A');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.ellipse(w * 0.47, h * 0.5, w * 0.33, h * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(200,245,150,0.45)';
  ctx.strokeStyle = 'rgba(35,95,35,0.7)';
  ctx.lineWidth = h * 0.02;
  const hex = (x: number, y: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r * 0.85;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  hex(w * 0.47, h * 0.5, w * 0.1);
  hex(w * 0.3, h * 0.5, w * 0.08);
  hex(w * 0.64, h * 0.5, w * 0.08);
  hex(w * 0.38, h * 0.26, w * 0.08);
  hex(w * 0.56, h * 0.26, w * 0.08);
  hex(w * 0.38, h * 0.74, w * 0.08);
  hex(w * 0.56, h * 0.74, w * 0.08);
  ctx.restore();
  ctx.strokeStyle = 'rgba(220,250,180,0.9)';
  ctx.lineWidth = h * 0.03;
  ctx.beginPath();
  ctx.ellipse(w * 0.47, h * 0.5, w * 0.33, h * 0.36, 0, 0, Math.PI * 2);
  ctx.stroke();
  shine(ctx, w * 0.44, h * 0.28, w * 0.18, h * 0.08, 0, 0.6);
}

function whale(ctx: Ctx, w: number, h: number): void {
  // 尾びれ
  ctx.fillStyle = '#3564AE';
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.48);
  ctx.quadraticCurveTo(w * 0.05, h * 0.28, w * 0.0, h * 0.2);
  ctx.quadraticCurveTo(w * 0.06, h * 0.42, w * 0.05, h * 0.5);
  ctx.quadraticCurveTo(w * 0.06, h * 0.6, w * 0.0, h * 0.8);
  ctx.quadraticCurveTo(w * 0.05, h * 0.7, w * 0.13, h * 0.55);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.97, h * 0.5);
  ctx.bezierCurveTo(w * 0.95, h * 0.22, w * 0.72, h * 0.12, w * 0.46, h * 0.2);
  ctx.bezierCurveTo(w * 0.3, h * 0.25, w * 0.18, h * 0.38, w * 0.1, h * 0.46);
  ctx.lineTo(w * 0.1, h * 0.54);
  ctx.bezierCurveTo(w * 0.26, h * 0.64, w * 0.55, h * 0.86, w * 0.85, h * 0.74);
  ctx.quadraticCurveTo(w * 0.97, h * 0.67, w * 0.97, h * 0.5);
  ctx.closePath();
  const body = ctx.createLinearGradient(0, h * 0.15, 0, h * 0.85);
  body.addColorStop(0, '#2C5CA6');
  body.addColorStop(0.5, '#5C92DA');
  body.addColorStop(0.7, '#CFE2FF');
  body.addColorStop(1, '#EAF3FF');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(150,185,230,0.8)';
  ctx.lineWidth = h * 0.012;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.93, h * (0.6 + i * 0.03));
    ctx.quadraticCurveTo(w * 0.75, h * (0.72 + i * 0.03), w * 0.56, h * (0.72 + i * 0.03));
    ctx.stroke();
  }
  ctx.restore();
  // 胸びれ
  const flip = ctx.createLinearGradient(0, h * 0.7, 0, h);
  flip.addColorStop(0, '#E4EEFB');
  flip.addColorStop(1, '#9CB8DE');
  ctx.fillStyle = flip;
  ctx.beginPath();
  ctx.moveTo(w * 0.66, h * 0.7);
  ctx.quadraticCurveTo(w * 0.58, h * 0.98, w * 0.4, h * 0.99);
  ctx.quadraticCurveTo(w * 0.52, h * 0.86, w * 0.57, h * 0.7);
  ctx.fill();
  eye(ctx, w * 0.84, h * 0.53, h * 0.035);
  shine(ctx, w * 0.6, h * 0.24, w * 0.26, h * 0.05, -0.08, 0.5);
}

function manta(ctx: Ctx, w: number, h: number): void {
  ctx.strokeStyle = '#27457E';
  ctx.lineWidth = h * 0.02;
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.5);
  ctx.lineTo(w * 0.0, h * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.98, h * 0.5);
  ctx.quadraticCurveTo(w * 0.8, h * 0.44, w * 0.56, h * 0.02);
  ctx.quadraticCurveTo(w * 0.5, h * 0.3, w * 0.22, h * 0.46);
  ctx.lineTo(w * 0.22, h * 0.54);
  ctx.quadraticCurveTo(w * 0.5, h * 0.7, w * 0.56, h * 0.98);
  ctx.quadraticCurveTo(w * 0.8, h * 0.56, w * 0.98, h * 0.5);
  ctx.closePath();
  const body = ctx.createRadialGradient(w * 0.62, h * 0.4, h * 0.05, w * 0.6, h * 0.5, w * 0.5);
  body.addColorStop(0, '#5A8EE0');
  body.addColorStop(0.6, '#2E5AA6');
  body.addColorStop(1, '#1C3772');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = 'rgba(210,230,255,0.6)';
  ctx.lineWidth = h * 0.025;
  ctx.stroke();
  // 頭のひれ
  ctx.fillStyle = '#244C92';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(w * 0.96, h * (0.5 + s * 0.07), w * 0.035, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 肩の白い模様
  ctx.fillStyle = 'rgba(235,245,255,0.55)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(w * 0.72, h * (0.5 + s * 0.16), w * 0.08, h * 0.05, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  shine(ctx, w * 0.66, h * 0.4, w * 0.16, h * 0.06, 0, 0.5);
}

function rainbow(ctx: Ctx, w: number, h: number): void {
  paintRainbow(ctx, w, h);
}

/** 風車（アイコン用）：緑の丘に大きな風車と小さな風車 */
function turbine(ctx: Ctx, w: number, h: number): void {
  // 丘
  const hill = ctx.createLinearGradient(0, h * 0.7, 0, h);
  hill.addColorStop(0, '#8EE05A');
  hill.addColorStop(1, '#3A9E35');
  ctx.fillStyle = hill;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.quadraticCurveTo(w * 0.3, h * 0.66, w * 0.62, h * 0.78);
  ctx.quadraticCurveTo(w * 0.85, h * 0.86, w, h * 0.8);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  const one = (cx: number, base: number, th: number) => {
    const tw = th * 0.2;
    ctx.save();
    ctx.shadowColor = 'rgba(20,70,130,0.55)';
    ctx.shadowBlur = th * 0.06;
    ctx.translate(cx - tw / 2, base - th);
    paintTurbineTower(ctx, tw, th);
    ctx.restore();
    ctx.save();
    const s = th * 0.9;
    ctx.shadowColor = 'rgba(20,70,130,0.55)';
    ctx.shadowBlur = th * 0.06;
    ctx.translate(cx - s / 2, base - th + th * 0.08 - s / 2);
    paintBlades(ctx, s);
    ctx.restore();
  };
  one(w * 0.74, h * 0.84, h * 0.42);
  one(w * 0.38, h * 0.8, h * 0.6);
}

function earth(ctx: Ctx, w: number, h: number): void {
  const s = Math.min(w, h);
  ctx.save();
  ctx.translate((w - s) / 2, (h - s) / 2);
  paintEarth(ctx, s);
  ctx.restore();
}

export interface CreatureArt {
  /** 幅 ÷ 高さ */
  aspect: number;
  paint: (ctx: Ctx, w: number, h: number) => void;
}

export const CREATURE_ART: Record<string, CreatureArt> = {
  goldfish: { aspect: 1.45, paint: goldfish },
  clownfish: { aspect: 1.55, paint: clownfish },
  tetra: { aspect: 2.4, paint: tetra },
  jellyfish: { aspect: 0.66, paint: jellyfish },
  dolphin: { aspect: 2.2, paint: dolphin },
  rainbow: { aspect: 2, paint: rainbow },
  turtle: { aspect: 1.5, paint: turtle },
  turbine: { aspect: 1, paint: turbine },
  whale: { aspect: 2.6, paint: whale },
  manta: { aspect: 1.8, paint: manta },
  earth: { aspect: 1, paint: earth },
};
