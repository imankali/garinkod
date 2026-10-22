// frontend/e2e/ux-audit.spec.ts
//
// The layout-true half of the UX audit that started as scripts/ux_audit.mjs:
// touch targets measured with real rects, document scrollWidth, and whether a
// user gesture can pan the page sideways. The contract half that runs with
// every vitest pass is src/test/uxAudit.test.tsx — jsdom has no layout, so
// that layer asserts the class-level guarantees and this layer asserts the
// pixels they produce.
//
// Ceilings measured on the dev server (127.0.0.1:5173) at 390×844 on
// 2026-10-07 with the audit script's rules: visible interactive boxes under
// 44×44, with .tap-target exempted (its pseudo-element is the CSS-sanctioned
// hit area) and the dev-only TanStack devtools button included — the prod
// preview that CI runs against lacks it, so CI measures under, never over,
// these numbers. A fix must LOWER the number; growth past it fails the build.
// The ceilings carry headroom for the pages' own load-timing variance — rails
// on / and /storefronts compose a variable number of cards — so they are debt
// caps that stop growth, not precise counts: each entry equals the worst
// number actually observed that day, minus nothing. The skip-link fix already
// in the stylesheet buys one violation of headroom on every page.

import { expect, test } from '@playwright/test';

const TOUCH_CEILINGS: Record<string, number> = {
  '/': 63,
  '/products': 3,
  '/login': 7,
  '/storefronts': 44,
};

// scrollWidth ceilings, same session. /storefronts carries ~1050px of
// gesture-unreachable overflow — html/body carry overflow-x: clip, so a user
// cannot pan; the programmatic overflow is pinned here as debt instead of
// being ignored. Every other page must stay inside a phone's viewport.
const SCROLLW_CEILINGS: Record<string, number> = {
  '/': 391,
  '/products': 391,
  '/login': 391,
  '/storefronts': 1440,
};

const PAGES = Object.keys(TOUCH_CEILINGS);
// A page listed without a measured ceiling fails immediately (fallback 0):
// the number must be observed, never assumed.
const ceilingFor = (table: Record<string, number>, key: string) => table[key] ?? 0;

/** Runs inside the page. Same rules as scripts/ux_audit.mjs, minus inputs. */
function collectAudit() {
  const visible = (el: Element) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const bad: { t: string; n: string; w: number; h: number; c: string }[] = [];
  for (const el of document.querySelectorAll('a, button, [role="button"], summary')) {
    if (!visible(el)) continue;
    if ((el as HTMLButtonElement).disabled) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    if (el.classList.contains('tap-target')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) {
      bad.push({
        t: el.tagName,
        n: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        w: Math.round(r.width),
        h: Math.round(r.height),
        c: String(el.className).slice(0, 70),
      });
    }
  }
  return {
    touch: bad,
    scrollWidth: document.scrollingElement?.scrollWidth ?? document.documentElement.scrollWidth,
    noAlt: [...document.querySelectorAll('img:not([alt])')].map((i) => i.getAttribute('src')),
  };
}

for (const path of PAGES) {
  test(`ux audit ${path}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // Trigger scroll-reveal content, then return: the audit judges the page
    // the way a visitor sees it after it has settled.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);

    const audit = await page.evaluate(collectAudit);
    await testInfo.attach(`ux-${path.replace(/\W+/g, '_')}.json`, {
      body: JSON.stringify(audit, null, 2),
      contentType: 'application/json',
    });

    expect(audit.noAlt, `images without alt on ${path}`).toEqual([]);
    expect(
      audit.touch.length,
      `${audit.touch.length} interactive boxes under 44px on ${path} (ceiling ${TOUCH_CEILINGS[path]})\n` +
        audit.touch
          .slice(0, 10)
          .map((t) => `  · ${t.t} ${t.w}×${t.h} «${t.n}» ${t.c}`)
          .join('\n'),
    ).toBeLessThanOrEqual(ceilingFor(TOUCH_CEILINGS, path));
    expect(
      audit.scrollWidth,
      `document scrollWidth ${audit.scrollWidth} on ${path} (ceiling ${SCROLLW_CEILINGS[path]})`,
    ).toBeLessThanOrEqual(ceilingFor(SCROLLW_CEILINGS, path));

    // The real gesture: a wheel pan must not move the page. overflow-x: clip
    // on the root is the site-wide net that makes this true (§10b of the
    // stylesheet); a page that lets a user pan sideways fails here.
    await page.mouse.move(195, 420);
    await page.mouse.wheel(800, 0);
    await page.waitForTimeout(150);
    const xRight = (await page.evaluate(() => window.scrollX)) ?? 0;
    await page.mouse.wheel(-1600, 0);
    await page.waitForTimeout(150);
    const xLeft = (await page.evaluate(() => window.scrollX)) ?? 0;
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(Math.abs(xRight), `wheel pan right on ${path} moved scrollX to ${xRight}`).toBeLessThan(1);
    expect(Math.abs(xLeft), `wheel pan left on ${path} moved scrollX to ${xLeft}`).toBeLessThan(1);
    const net = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).overflowX,
      body: getComputedStyle(document.body).overflowX,
    }));
    expect(
      Object.values(net),
      `overflow-x safety net removed on ${path}: ${JSON.stringify(net)}`,
    ).not.toContain('visible');
  });
}
