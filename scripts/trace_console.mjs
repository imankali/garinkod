/**
 * Focused console tracer: opens one page with the laptop's Chrome and prints every
 * console message + failed request in FULL (no truncation), so an unknown-prop
 * warning names the actual prop and a 401 names the actual URL.
 *
 * Usage (repo root): node scripts/trace_console.mjs [path]
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(
  pathToFileURL(path.join(REPO, 'frontend', 'node_modules', 'playwright', 'index.mjs')).href
);

const target = process.argv[2] || '/products/kood-query-probe-11';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'fa-IR',
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

page.on('console', (m) => console.log(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('response', async (res) => {
  if (res.status() >= 400) {
    console.log(`[http ${res.status()}] ${res.request().method()} ${res.url()}`);
  }
});

await page.goto(`http://127.0.0.1:5173${target}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(4000);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1000);

await browser.close();
