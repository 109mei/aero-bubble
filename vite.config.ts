import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * 読み込めるものを絞る決まり（Content Security Policy）。
 * スクリプトはこのサイトのものだけ、書体は Google Fonts だけ、通信はこのサイトだけ。
 * GitHub Pages では応答の見出しを設定できないので、index.html の meta に書く
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/** 公開用のビルドにだけ CSP を入れる（開発中の Vite は、その場でスクリプトを差し込むため） */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'aero-bubble-content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`;
      if (!html.includes('<meta charset="UTF-8" />')) throw new Error('index.html に <meta charset="UTF-8" /> がない');
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${meta}`);
    },
  };
}

/** 版の番号（設定のシートに出す） */
const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;

export default defineConfig({
  base: '/aero-bubble/',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), contentSecurityPolicy()],
  // PixiJS を1つにまとめているので、既定の 500kB を少し超える
  build: { chunkSizeWarningLimit: 900 },
  server: { port: 5176 },
  preview: { port: 4176 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
