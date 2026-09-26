import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { debug, findChain, ready, startPlaying, type Point } from './helpers';

/** npm run screens：主な画面のスクリーンショットを docs/screens/ に保存する（390×844、2倍） */

const DIR = 'docs/screens';
mkdirSync(DIR, { recursive: true });

async function shot(page: Page, name: string, wait = 600): Promise<void> {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${DIR}/${name}.png` });
}

async function holdChain(page: Page, points: Point[]): Promise<void> {
  const [first, ...rest] = points;
  if (!first) return;
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of rest) await page.mouse.move(p.x, p.y, { steps: 3 });
}

test('主な画面', async ({ page }) => {
  await page.goto('./?debug=1&seed=20260927');
  await ready(page);
  await shot(page, '01_title', 1500);

  await page.getByTestId('play').click();
  await expect(page.getByTestId('sheet-howto')).toBeVisible();
  await shot(page, '02_howto');
  await page.getByTestId('howto-ok').click();
  await shot(page, '03_countdown', 900);

  await debug(page, 'skipCountdown()');
  await page.waitForTimeout(800);
  const ch = await findChain(page);
  await holdChain(page, ch.points);
  await shot(page, '04_linking', 400);
  await page.mouse.up();
  await page.waitForTimeout(300);

  await debug(page, "placeSpecial('bomb', 17, 0)");
  await debug(page, "placeSpecial('prism', 38, 3)");
  await shot(page, '05_specials', 700);

  await debug(page, 'setGauge(49)');
  const ch2 = await findChain(page);
  await holdChain(page, ch2.points);
  await page.mouse.up();
  await shot(page, '06_fever', 900);

  await page.getByTestId('pause').click();
  await shot(page, '07_pause', 500);
  await page.getByTestId('resume').click();

  await debug(page, 'setTimeLeft(0.2)');
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 10000 });
  await shot(page, '08_result', 1800);

  await page.getByTestId('to-title').click();
  await debug(page, 'grant({ rounds: 40, totalPopped: 20000, maxChain: 13, totalFevers: 40, bestFevers: 5, best: 180000 })');
  await shot(page, '09_title_all', 2500);

  await page.getByTestId('open-aquarium').click();
  await shot(page, '10_aquarium', 800);
  await page.getByTestId('sheet-close').click();

  await page.getByTestId('open-settings').click();
  await shot(page, '11_settings', 700);
  await page.getByTestId('sheet-close').click();
});

test('背の低い画面（390×664：iPhone の Safari 相当）', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('./?debug=1&seed=7');
  await ready(page);
  await shot(page, '12_short_title', 1500);
  await startPlaying(page);
  await shot(page, '13_short_playing', 1200);
});
