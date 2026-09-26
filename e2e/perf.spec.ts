import { expect, test } from '@playwright/test';
import { debug, findChain, ready, startPlaying, trace } from './helpers';

/**
 * 描画の重さを測る（PW_SOFTWARE_GL=1 で GPU なしの描画にすると、GitHub Actions と同じ条件になる）。
 * 1フレームの間隔と、なぞる操作にかかる時間を出す。
 */
test('描画の重さ', async ({ page }) => {
  await page.goto('./?debug=1&seed=3');
  await ready(page);
  await page.waitForTimeout(1500);
  const title = await debug<{ render: number; frame: number }>(page, 'renderMs()');
  await startPlaying(page);
  await page.waitForTimeout(1500);
  const game = await debug<{ render: number; frame: number }>(page, 'renderMs()');
  const ch = await findChain(page);
  const t0 = Date.now();
  await trace(page, ch.points);
  const traceMs = Date.now() - t0;
  console.log(`タイトル：描画 ${title.render.toFixed(1)}ms／フレーム間隔 ${title.frame.toFixed(1)}ms`);
  console.log(`あそぶ：描画 ${game.render.toFixed(1)}ms／フレーム間隔 ${game.frame.toFixed(1)}ms`);
  console.log(`${ch.cells.length}つなぎをなぞるのに ${traceMs}ms`);
  expect(game.frame).toBeGreaterThan(0);
});
