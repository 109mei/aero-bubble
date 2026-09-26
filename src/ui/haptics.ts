import type { GameEvent } from '../core';

/** 振動（対応している端末だけ。iPhone のブラウザは振動できない） */
let enabled = true;

export function setVibration(on: boolean): void {
  enabled = on;
}

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function buzz(ms: number | number[]): void {
  if (!enabled || !canVibrate()) return;
  try {
    navigator.vibrate(ms);
  } catch {
    // 振動できなくても遊べる
  }
}

export function hapticsFor(ev: GameEvent[]): void {
  for (const e of ev) {
    if (e.type === 'link') buzz(6);
    else if (e.type === 'pop') buzz(e.made ? [18, 40, 28] : 16);
    else if (e.type === 'burst' && !e.chained) buzz(40);
    else if (e.type === 'feverStart') buzz([20, 60, 20, 60, 40]);
  }
}
