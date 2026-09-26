import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/** npm run screens：主な画面のスクリーンショットを docs/screens/ に保存する（780×1688） */
export default defineConfig({
  ...base,
  testMatch: /(screens|og)\.spec\.ts/,
  testIgnore: undefined,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 120_000,
  use: {
    ...base.use,
    deviceScaleFactor: 2,
  },
});
