import { expect, type Page } from '@playwright/test';

export interface Point {
  x: number;
  y: number;
}

/** ?debug=1 のときだけある窓口を呼ぶ */
export async function debug<T>(page: Page, call: string): Promise<T> {
  return page.evaluate(`(() => window.__aero.${call})()`) as Promise<T>;
}

/** 書体と絵（PixiJS）の準備を待つ */
export async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.world === 'ready');
  await page.evaluate(async () => {
    await document.fonts.ready;
    return true;
  });
}

/** タイトルから遊び始め、数え始めを飛ばす（はじめてなら、あそびかたを閉じる） */
export async function startPlaying(page: Page): Promise<void> {
  await page.getByTestId('play').click();
  const howto = page.getByTestId('howto-ok');
  if (await howto.isVisible().catch(() => false)) await howto.click();
  await expect(page.getByTestId('pause')).toBeVisible();
  await debug(page, 'skipCountdown()');
  await expect.poll(() => debug<{ round: { phase: string } | null }>(page, 'state()').then((s) => s.round?.phase)).toBe('playing');
}

/**
 * 泡の上を指でなぞる（泡の中心から中心へ1回ずつ動かす。間の泡は、ゲームが通った道を調べて拾う）。
 * ブラウザは指の動きを1フレームに1回まとめて届けるので、動かす回数を少なくする
 */
export async function trace(page: Page, points: Point[]): Promise<void> {
  const [first, ...rest] = points;
  if (!first) return;
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of rest) await page.mouse.move(p.x, p.y);
  await page.mouse.up();
}

/** いちばん長くつなげる道（テスト用の窓口で探す） */
export async function findChain(page: Page, min = 3): Promise<{ cells: number[]; points: Point[] }> {
  const ch = await debug<{ cells: number[]; points: Point[] } | null>(page, `findChain(${min})`);
  if (!ch || ch.cells.length < min) throw new Error('つなげる泡が見つからない');
  return ch;
}

export async function score(page: Page): Promise<number> {
  return Number(await page.getByTestId('score').getAttribute('data-value'));
}
