import { defineConfig, devices } from '@playwright/test';

/** e2e：390×844 のスマホ縦画面で、テスト用のビルドを動かして確かめる */
const PORT = 4176;

export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.spec\.ts/,
  testIgnore: /(screens|og)\.spec\.ts/,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}/aero-bubble/`,
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    locale: 'ja-JP',
    colorScheme: 'light',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium-390x844' }],
  webServer: {
    // テスト用のビルド（--mode e2e）：テスト用の窓口（?debug=1）が入る。公開用のビルド（npm run build）には入らない
    command: `npx vite build --mode e2e && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/aero-bubble/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
