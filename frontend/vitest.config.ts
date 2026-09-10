// frontend/vitest.config.ts
//
// Component and unit tests, run in jsdom (`npm run test:unit`).
//
// These are the tests a browser suite cannot replace economically: the rules a
// screen decides by — which badge a card is allowed to wear, what makes a submit
// button enabled, where a gate sends a signed-out visitor — are pure enough to
// assert without a server, and they are the rules that regress silently when a
// card or a form is restyled. Playwright still owns the journeys; this owns the
// decisions.
//
// A separate config keeps the build (PWA manifest, service worker, proxy-free
// dev server) untouched: tests neither depend on nor disturb `vite.config.ts`.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // The stylesheets are Tailwind utilities; no component behaviour lives in
    // them, and parsing them per test file only slows the run down.
    css: false,
    restoreMocks: true,
  },
});
