import { readFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { debug, ready } from './helpers';

/**
 * npm run screens のついでに、共有用の画像（public/og.png 1200×630）と
 * ホーム画面のアイコン（public/apple-touch-icon.png 180×180）を作る
 */

test.use({ deviceScaleFactor: 1 });

test('共有用の画像', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto('./?debug=1&seed=1');
  await ready(page);
  await debug(page, 'grant({ rounds: 40, totalPopped: 20000, maxChain: 13, totalFevers: 40, bestFevers: 5, best: 180000 })');
  await page.waitForTimeout(500);
  // 共有の画像にはボタンを写さない（CSP の下なので style 要素ではなく、要素の style を書き換える）
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('.title-row, .best-chip, .tagline')) el.style.visibility = 'hidden';
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'public/og.png' });
});

test('ホーム画面のアイコン', async ({ page }) => {
  const svg = readFileSync('public/favicon.svg', 'utf8');
  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(
    `<html><body style="margin:0"><div id="icon" style="width:180px;height:180px;display:grid;place-items:center;background:linear-gradient(180deg,#0A6FD8 0%,#2F9BEE 40%,#8FD8FF 49%,#E4F8FF 50%,#7FE6F8 52%,#1591DB 100%)">${svg.replace('<svg ', '<svg width="140" height="140" ')}</div></body></html>`,
  );
  await page.locator('#icon').screenshot({ path: 'public/apple-touch-icon.png' });
});
