import { expect, test, type Page } from '@playwright/test';
import { debug, findChain, ready, score, startPlaying, trace, type Point } from './helpers';

interface StateLike {
  progress: { best: number; unlocked: string[]; rounds: number; tutorialSeen: boolean };
  round: null | {
    phase: string;
    score: number;
    timeLeft: number;
    feverLeft: number;
    chain: number[];
    stats: { chains: number; bursts: number; popped: number };
    board: { cells: { kind: string; color: number }[] };
  };
}

const state = (page: Page) => debug<StateLike>(page, 'state()');

test.beforeEach(async ({ page }) => {
  await page.goto('./?debug=1');
  await ready(page);
});

test('スマホ縦画面で開き、タイトルが横にはみ出さない', async ({ page }) => {
  await expect(page.getByTestId('play')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'エアロバブル' })).toBeVisible();
  await expect(page.locator('canvas[data-testid="world"]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('はじめては、あそびかたを見てから数え始めになる', async ({ page }) => {
  await page.getByTestId('play').click();
  await expect(page.getByTestId('sheet-howto')).toBeVisible();
  await page.getByTestId('howto-ok').click();
  await expect(page.getByTestId('countdown')).toBeVisible();
  await expect.poll(async () => (await state(page)).round?.phase, { timeout: 6000 }).toBe('playing');
  expect((await state(page)).progress.tutorialSeen).toBe(true);
});

test('泡をなぞってつなぐと、はじけて点数が増える', async ({ page }) => {
  await startPlaying(page);
  const ch = await findChain(page);
  await trace(page, ch.points);
  await expect.poll(() => score(page)).toBeGreaterThan(0);
  const s = await state(page);
  expect(s.round!.stats.chains).toBe(1);
  expect(s.round!.stats.popped).toBe(ch.cells.length);
  expect(s.round!.chain).toEqual([]);
});

test('3つに足りずに指を離すと、何も消えない', async ({ page }) => {
  await startPlaying(page);
  const ch = await findChain(page);
  await trace(page, ch.points.slice(0, 2));
  await page.waitForTimeout(150);
  const s = await state(page);
  expect(s.round!.score).toBe(0);
  expect(s.round!.stats.chains).toBe(0);
  expect(s.round!.chain).toEqual([]);
});

test('アクアボムはタップすると、まわりの泡をまとめて消す', async ({ page }) => {
  await startPlaying(page);
  await debug(page, "placeSpecial('bomb', 27, 0)");
  const p = await debug<Point>(page, 'cellPoint(27)');
  await page.mouse.click(p.x, p.y);
  await expect.poll(async () => (await state(page)).round!.stats.bursts).toBe(1);
  const s = await state(page);
  expect(s.round!.stats.popped).toBeGreaterThanOrEqual(19);
  expect(await score(page)).toBeGreaterThan(0);
});

test('ゲージがたまるとエアロタイムになり、時間が止まる', async ({ page }) => {
  await startPlaying(page);
  await debug(page, 'setGauge(49)');
  const ch = await findChain(page);
  await trace(page, ch.points);
  await expect(page.getByTestId('gauge')).toHaveAttribute('data-fever', 'true');
  await expect(page.getByTestId('banner-fever')).toBeVisible();
  const t1 = (await state(page)).round!.timeLeft;
  await page.waitForTimeout(700);
  const s = await state(page);
  expect(s.round!.feverLeft).toBeGreaterThan(0);
  expect(s.round!.timeLeft).toBe(t1);
});

test('一時停止すると時間が止まり、つづけるとまた動く', async ({ page }) => {
  await startPlaying(page);
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('sheet-pause')).toBeVisible();
  const t1 = (await state(page)).round!.timeLeft;
  await page.waitForTimeout(800);
  expect((await state(page)).round!.timeLeft).toBe(t1);
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('sheet-pause')).toBeHidden();
  await expect.poll(async () => (await state(page)).round!.timeLeft).toBeLessThan(t1);
  // タイトルへ戻ると、記録には何も足さない
  await page.getByTestId('pause').click();
  await page.getByTestId('quit').click();
  await expect(page.getByTestId('play')).toBeVisible();
  const s = await state(page);
  expect(s.round).toBeNull();
  expect(s.progress.rounds).toBe(0);
});

test('時間切れで結果になり、仲間が増えて、もういちど遊べる', async ({ page }) => {
  await startPlaying(page);
  const ch = await findChain(page);
  await trace(page, ch.points);
  await expect.poll(() => score(page)).toBeGreaterThan(0);
  await debug(page, 'setTimeLeft(0.3)');
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('new-best')).toBeVisible();
  await expect(page.getByTestId('new-friends')).toContainText('きんぎょ');
  const s = await state(page);
  expect(s.round).toBeNull();
  expect(s.progress.rounds).toBe(1);
  expect(s.progress.best).toBeGreaterThan(0);
  await page.getByTestId('retry').click();
  await expect(page.getByTestId('pause')).toBeVisible();
  await expect.poll(async () => (await state(page)).round?.phase).toBe('countdown');
});

test('再読み込みしても、最高点と仲間が残る', async ({ page }) => {
  await startPlaying(page);
  const ch = await findChain(page);
  await trace(page, ch.points);
  await expect.poll(() => score(page)).toBeGreaterThan(0);
  await debug(page, 'setTimeLeft(0.3)');
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 8000 });
  const best = (await state(page)).progress.best;
  await page.reload();
  await ready(page);
  await expect(page.getByTestId('best')).toContainText(new Intl.NumberFormat('ja-JP').format(best));
  await page.getByTestId('open-aquarium').click();
  await expect(page.getByTestId('friend-goldfish')).toHaveAttribute('data-unlocked', 'true');
  await expect(page.getByTestId('aquarium-count')).toContainText('/');
});

test('あそびの途中で再読み込みしても、つづきから遊べる', async ({ page }) => {
  await startPlaying(page);
  const ch = await findChain(page);
  await trace(page, ch.points);
  await expect.poll(() => score(page)).toBeGreaterThan(0);
  const before = (await state(page)).round!.score;
  await debug(page, 'save()');
  await page.reload();
  await ready(page);
  await expect(page.getByTestId('sheet-pause')).toBeVisible();
  await expect(page.getByTestId('sheet-pause')).toContainText('つづきから');
  expect((await state(page)).round!.score).toBe(before);
  await page.getByTestId('resume').click();
  const ch2 = await findChain(page);
  await trace(page, ch2.points);
  await expect.poll(async () => (await state(page)).round!.score).toBeGreaterThan(before);
});

test('アクアリウム・あそびかた・設定のシートが開いて閉じる', async ({ page }) => {
  for (const [open, sheet] of [
    ['open-aquarium', 'sheet-aquarium'],
    ['open-howto', 'sheet-howto'],
    ['open-settings', 'sheet-settings'],
  ] as const) {
    await page.getByTestId(open).click();
    await expect(page.getByTestId(sheet)).toBeVisible();
    await page.getByTestId('sheet-close').click();
    await expect(page.getByTestId(sheet)).toBeHidden();
  }
  // 設定は保存される
  await page.getByTestId('open-settings').click();
  await page.getByTestId('toggle-music').click();
  await expect(page.getByTestId('toggle-music')).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await ready(page);
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('toggle-music')).toHaveAttribute('aria-checked', 'false');
});

test('記録を書き出して、消したあとに読み込むと戻る', async ({ page }) => {
  await debug(page, 'grant({ best: 123456, rounds: 12, totalPopped: 2500, maxChain: 9 })');
  await page.getByTestId('open-settings').click();
  await page.getByTestId('export').click();
  const text = await page.getByTestId('export-text').inputValue();
  expect(text.startsWith('AERO1.')).toBe(true);
  // ぜんぶ消す
  await page.getByRole('button', { name: 'ぜんぶ消す' }).click();
  await page.getByTestId('reset-yes').click();
  await expect.poll(async () => (await state(page)).progress.best).toBe(0);
  // 読み込む
  await page.getByTestId('open-settings').click();
  await page.getByTestId('import-text').fill(text);
  await page.getByTestId('import').click();
  await expect(page.getByTestId('toast')).toContainText('読み込みました');
  const s = await state(page);
  expect(s.progress.best).toBe(123456);
  expect(s.progress.unlocked).toContain('turtle');
  // 壊れたテキストは読まない（記録はそのまま）
  await page.getByTestId('open-settings').click();
  await page.getByTestId('import-text').fill('AERO1.こわれている');
  await page.getByTestId('import').click();
  await expect(page.getByTestId('toast')).toContainText('読み込めませんでした');
  expect((await state(page)).progress.best).toBe(123456);
});

test('読み込めるものを絞る決まり（CSP）に触れずに遊べる', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') violations.push(m.text());
  });
  // 読み込みの最初から見張る
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.reload();
  await ready(page);
  const meta = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(meta).toContain("script-src 'self'");
  await startPlaying(page);
  const ch = await findChain(page);
  await trace(page, ch.points);
  await expect.poll(() => score(page)).toBeGreaterThan(0);
  await page.getByTestId('pause').click();
  await page.getByTestId('quit').click();
  await page.getByTestId('open-aquarium').click();
  await page.waitForTimeout(300);
  const csp = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(csp).toEqual([]);
  expect(violations.filter((v) => /Content Security Policy|unsafe-eval|Refused/i.test(v))).toEqual([]);
});

for (const size of [
  { width: 360, height: 640 },
  { width: 430, height: 932 },
  { width: 390, height: 664 },
]) {
  test(`${size.width}×${size.height} でも盤面が画面に収まる`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.reload();
    await ready(page);
    await startPlaying(page);
    const corners = await page.evaluate(() => {
      const w = window as unknown as { __aero: { cellPoint: (c: number) => { x: number; y: number }; layout: () => { board: { r: number; cols: number; rows: number }; scale: number } } };
      const L = w.__aero.layout();
      const n = L.board.cols * L.board.rows;
      return { pts: [0, L.board.rows - 1, n - L.board.rows, n - 1].map((c) => w.__aero.cellPoint(c)), r: L.board.r * L.scale };
    });
    for (const p of corners.pts) {
      expect(p.x - corners.r).toBeGreaterThanOrEqual(0);
      expect(p.x + corners.r).toBeLessThanOrEqual(size.width);
      expect(p.y - corners.r).toBeGreaterThanOrEqual(0);
      expect(p.y + corners.r).toBeLessThanOrEqual(size.height);
    }
    // 泡は指で押せる大きさ（直径 44px 以上）
    expect(corners.r * 2).toBeGreaterThanOrEqual(44);
    const ch = await findChain(page);
    await trace(page, ch.points);
    await expect.poll(() => score(page)).toBeGreaterThan(0);
  });
}
