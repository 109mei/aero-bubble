/**
 * 絵の色。泡の5色は、色だけに頼らないよう印（しずく・葉・太陽・花・星）とも組にする。
 * ここの色の値は絵（Canvas2D と PixiJS）だけで使う。画面の部品の色は styles.css の変数。
 */

export interface BubbleColor {
  name: string;
  /** 印の形 */
  icon: IconKind;
  base: string;
  light: string;
  dark: string;
  deep: string;
  /** 光（PixiJS の tint） */
  glow: number;
}

export type IconKind = 'drop' | 'leaf' | 'sun' | 'flower' | 'star' | 'heart';

export const BUBBLE_COLORS: readonly BubbleColor[] = [
  { name: 'しずく', icon: 'drop', base: '#1E96FF', light: '#B4ECFF', dark: '#0B58D0', deep: '#073A94', glow: 0x62d2ff },
  { name: 'はっぱ', icon: 'leaf', base: '#32C23A', light: '#D2FAB0', dark: '#138A2A', deep: '#0A5A1C', glow: 0x8cf26c },
  { name: 'たいよう', icon: 'sun', base: '#FFB200', light: '#FFF3A8', dark: '#E26C00', deep: '#A84800', glow: 0xffd84f },
  { name: 'はな', icon: 'flower', base: '#FF4C9D', light: '#FFD0E6', dark: '#C4155F', deep: '#860A3E', glow: 0xff8dc6 },
  { name: 'ほし', icon: 'star', base: '#8F5AFF', light: '#E2D3FF', dark: '#5225CC', deep: '#33138E', glow: 0xbc9dff },
  { name: 'ハート', icon: 'heart', base: '#FF6A3D', light: '#FFD7C4', dark: '#CF3E14', deep: '#8E2508', glow: 0xff9f7a },
];

export function rgba(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** 種つきの小さな乱数（絵の形を毎回同じにする） */
export function artRandom(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas2D が使えない');
  return { canvas, ctx };
}
