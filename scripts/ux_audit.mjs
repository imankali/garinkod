/**
 * Mobile-first UI/UX audit using the laptop's installed Chrome (channel: 'chrome').
 *
 * Per page x viewport: screenshots + horizontal overflow + touch targets <44px
 * + text <12px + fixed/sticky bars + console errors + axe (mobile only).
 *
 * Usage (repo root): node scripts/ux_audit.mjs
 * Output: .agents-tmp/ux-audit/*.png + report.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// playwright lives in frontend/node_modules; resolve it directly from this script.
const { chromium } = await import(
  pathToFileURL(path.join(REPO, 'frontend', 'node_modules', 'playwright', 'index.mjs')).href
);
const AXE_URL = pathToFileURL(
  path.join(REPO, 'frontend', 'node_modules', '@axe-core', 'playwright', 'dist', 'index.mjs')
).href;

const OUT = path.join(REPO, '.agents-tmp', 'ux-audit');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://127.0.0.1:5173';
const PAGES = [
  { name: 'home', url: `${BASE}/` },
  { name: 'shop', url: `${BASE}/products` },
  { name: 'product', url: `${BASE}/products/kood-query-probe-11` },
  { name: 'login', url: `${BASE}/login` },
];
const VIEWPORTS = [
  { name: '360x640', width: 360, height: 640 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
];

/** Runs inside the page. Returns layout metrics for the current viewport. */
function collectMetrics() {
  const vw = window.innerWidth;
  const doc = document.scrollingElement;
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // horizontal overflow: keep only deepest offenders (no offending child)
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) offenders.push(el);
  }
  const offSet = new Set(offenders);
  const deepest = offenders.filter((el) => ![...el.children].some((c) => offSet.has(c)));
  const overflow = {
    scrollWidth: doc.scrollWidth,
    innerWidth: vw,
    hasHorizontalScroll: doc.scrollWidth > vw + 1,
    offenders: deepest.slice(0, 15).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        cls: String(el.className || '').slice(0, 100),
        text: (el.textContent || '').trim().slice(0, 60),
        left: Math.round(r.left),
        right: Math.round(r.right),
      };
    }),
  };

  // touch targets < 44px
  const targets = [];
  const sel = 'a, button, [role="button"], input, select, textarea, summary, [onclick]';
  for (const el of document.querySelectorAll(sel)) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) {
      targets.push({
        tag: el.tagName,
        text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 45),
        w: Math.round(r.width),
        h: Math.round(r.height),
        cls: String(el.className || '').slice(0, 80),
      });
    }
  }
  targets.sort((a, b) => a.w * a.h - b.w * b.h);

  // text below 12px on elements with direct text
  const smallText = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasOwnText) continue;
    const fontSize = parseFloat(getComputedStyle(el).fontSize);
    if (fontSize < 12) {
      smallText.push({ tag: el.tagName, fontSize, text: (el.textContent || '').trim().slice(0, 50) });
    }
  }

  // fixed / sticky bars
  const bars = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const pos = getComputedStyle(el).position;
    if (pos === 'fixed' || pos === 'sticky') {
      const r = el.getBoundingClientRect();
      bars.push({
        pos, tag: el.tagName,
        cls: String(el.className || '').slice(0, 80),
        top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
      });
    }
  }

  return {
    title: document.title,
    dir: document.documentElement.getAttribute('dir'),
    lang: document.documentElement.getAttribute('lang'),
    overflow,
    touchTargetsUnder44: { count: targets.length, worst: targets.slice(0, 12) },
    smallText: { count: smallText.length, worst: smallText.slice(0, 8) },
    bars,
  };
}
const report = [];
const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      locale: 'fa-IR',
      isMobile: vp.width < 768,
      hasTouch: vp.width < 768,
    });
    for (const p of PAGES) {
      const page = await context.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

      await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      // trigger scroll-reveal content, then return to top
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(900);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(600);

      const metrics = await page.evaluate(collectMetrics);

      const shot = path.join(OUT, `${p.name}-${vp.name}.png`);
      await page.screenshot({ path: shot, fullPage: vp.name === '390x844' });

      // axe on mobile only, best effort
      let axe = null;
      if (vp.name === '390x844') {
        try {
          const { default: AxeBuilder } = await import(AXE_URL);
          const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
          axe = results.violations.map((v) => ({
            id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
            sample: v.nodes[0]?.target?.join(' ')?.slice(0, 120),
          }));
        } catch (e) {
          axe = [{ id: 'axe-run-failed', help: String(e).slice(0, 200) }];
        }
      }

      // product page (mobile): try opening the cart drawer for a screenshot
      let cartShot = null;
      if (p.name === 'product' && vp.name === '390x844') {
        try {
          const btn = page.locator('button', { hasText: /افزودن/ }).first();
          await btn.click({ timeout: 4000 });
          await page.waitForTimeout(1200);
          cartShot = path.join(OUT, 'product-cart-drawer-390x844.png');
          await page.screenshot({ path: cartShot });
        } catch (e) {
          errors.push('cart-open-failed: ' + String(e).split('\n')[0].slice(0, 150));
        }
      }

      report.push({
        page: p.name,
        url: p.url,
        viewport: vp.name,
        metrics,
        consoleErrors: [...new Set(errors)].slice(0, 6),
        screenshots: [shot, cartShot].filter(Boolean),
      });
      console.log(`done: ${p.page || p.name} @ ${vp.name}`);
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log('REPORT:', path.join(OUT, 'report.json'));

