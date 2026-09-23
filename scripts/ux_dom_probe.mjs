/**
 * DOM probes for the mobile audit — things a source scan cannot answer.
 *
 *  1. Does React actually render the `fetchPriority` attribute on the gallery image?
 *  2. What is the injected `tsqd-open-btn-container`, and does it overlap the bottom nav?
 *  3. Which fixed element is 812px tall with an empty class?
 *  4. Which elements overlap the bottom tab bar?
 *
 * Usage (repo root): node scripts/ux_dom_probe.mjs
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(
  pathToFileURL(path.join(REPO, 'frontend', 'node_modules', 'playwright', 'index.mjs')).href
);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'fa-IR',
  isMobile: true,
  hasTouch: true,
});

/** Everything the probe observed, written to disk so nothing is lost to a pipe. */
const all = [];

for (const target of ['/products/kood-query-probe-11', '/']) {
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:5173${target}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);

  const result = await page.evaluate(() => {
    const describe = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        cls: String(el.className || '').slice(0, 120),
        id: el.id || null,
        text: (el.textContent || '').trim().slice(0, 40),
        rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) },
        z: s.zIndex,
        pos: s.position,
      };
    };

    const img = document.querySelector('picture > img');
    const fetchAttr = img
      ? {
          hasAttributeFetchpriority: img.hasAttribute('fetchpriority'),
          attrValue: img.getAttribute('fetchpriority'),
          src: img.currentSrc || img.src,
          naturalWidth: img.naturalWidth,
          complete: img.complete,
          loading: img.getAttribute('loading'),
          decoding: img.getAttribute('decoding'),
        }
      : null;

    const tsqd = describe(document.querySelector('.tsqd-open-btn-container'));

    // every fixed element that is a direct child of body or a portal root
    const fixedAll = [...document.querySelectorAll('body *')]
      .filter((el) => getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().height > 0)
      .map(describe);

    const nav = [...document.querySelectorAll('nav')].find(
      (n) => getComputedStyle(n).position === 'fixed' && n.getBoundingClientRect().bottom > window.innerHeight - 5,
    );
    const navRect = nav ? nav.getBoundingClientRect() : null;

    // what overlaps the bottom tab bar?
    const overlaps = [];
    if (navRect) {
      for (const el of document.querySelectorAll('body *')) {
        if (nav.contains(el) || el.contains(nav)) continue;
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) === 0) continue;
        const r = el.getBoundingClientRect();
        if (r.height === 0 || r.width === 0) continue;
        const overlapY = Math.min(r.bottom, navRect.bottom) - Math.max(r.top, navRect.top);
        const overlapX = Math.min(r.right, navRect.right) - Math.max(r.left, navRect.left);
        if (overlapY > 8 && overlapX > 8) {
          if ([...el.children].some((c) => {
            const cr = c.getBoundingClientRect();
            return Math.min(cr.bottom, navRect.bottom) - Math.max(cr.top, navRect.top) > 8;
          })) continue;
          overlaps.push({ ...describe(el), overlapY: Math.round(overlapY), overlapX: Math.round(overlapX) });
        }
      }
    }

    // touch targets under 44px, full list (deepest interactive elements)
    const small = [];
    for (const el of document.querySelectorAll('a, button, [role="button"], input, select, textarea, summary, [onclick]')) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 44 || r.height < 44) {
        small.push({
          tag: el.tagName,
          w: Math.round(r.width),
          h: Math.round(r.height),
          name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
          cls: String(el.className || '').slice(0, 70),
          top: Math.round(r.top),
        });
      }
    }

    return { fetchAttr, tsqd, fixedAll, nav: describe(nav), overlaps: overlaps.slice(0, 20), smallCount: small.length, small: small.slice(0, 40) };
  });

  // --- The classic mobile trap: is the last content permanently behind the
  // fixed bottom bar? Overlap at scrollTop 0 means nothing; overlap at the
  // bottom of the scroll means the buyer can never reach that control.
  //
  // The scroll must be instant: `scroll-behavior: smooth` (which this site sets)
  // animates scrollTo, and measuring on the next line reports a mid-flight
  // position — the first run of this probe did exactly that and produced a
  // footer bottom of 5129px at "max scroll".
  const bottomProbe = await page.evaluate(async () => {
    const doc = document.scrollingElement;
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';

    const navs = [...document.querySelectorAll('nav')];
    const nav = navs.find(
      (n) => getComputedStyle(n).position === 'fixed' && n.getBoundingClientRect().bottom > window.innerHeight - 5,
    );
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const navTop = navRect ? navRect.top : window.innerHeight;
    // The bar's own controls may sit inside it or in a portal; either way they
    // are the bar, not content it covers.
    const barDescendants = nav ? new Set([nav, ...nav.querySelectorAll('*')]) : new Set();

    doc.scrollTop = doc.scrollHeight;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 400));
    doc.scrollTop = doc.scrollHeight;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const buried = [];
    for (const el of document.querySelectorAll('a, button, [role="button"], input, select, textarea, summary')) {
      if (barDescendants.has(el)) continue;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom > navTop + 2 && r.top < navRect.bottom) {
        buried.push({
          tag: el.tagName,
          name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          pos: s.position,
          cls: String(el.className || '').slice(0, 70),
        });
      }
    }

    const lastContent = document.querySelector('footer') || document.querySelector('main');
    const lastRect = lastContent ? lastContent.getBoundingClientRect() : null;

    /** Text-bearing nodes still under the bar at the very bottom of the scroll. */
    const coveredText = [...document.querySelectorAll('p, span, h1, h2, h3, h4, li, small, address')]
      .filter((el) => {
        if (barDescendants.has(el)) return false;
        if (!(el.textContent || '').trim()) return false;
        if ([...el.children].some((c) => (c.textContent || '').trim())) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > navTop + 2 && r.top < navRect.bottom;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, text: (el.textContent || '').trim().slice(0, 60), top: Math.round(r.top), bottom: Math.round(r.bottom) };
      })
      .slice(0, 12);

    /** Which element actually receives a tap along the tab bar — the bar, or something stacked on it? */
    const tabBarTopHit = [];
    for (let x = 25; x < window.innerWidth - 10; x += 45) {
      const hit = document.elementFromPoint(x, navTop + 30);
      tabBarTopHit.push({
        x,
        tag: hit ? hit.tagName : null,
        cls: hit ? String(hit.className || '').split(' ')[0].slice(0, 40) : null,
        inBar: hit ? barDescendants.has(hit) : false,
      });
    }

    const footerEl = document.querySelector('footer');
    const result = {
      footerPaddingBottom: footerEl ? getComputedStyle(footerEl).paddingBottom : null,
      coveredText,
      tabBarTopHit,
      navCount: navs.length,
      navCls: String(nav?.className || '').slice(0, 90),
      navDescendants: nav ? nav.querySelectorAll('*').length : 0,
      scrollTop: Math.round(doc.scrollTop),
      scrollHeight: doc.scrollHeight,
      clientHeight: doc.clientHeight,
      atBottom: doc.scrollTop + doc.clientHeight >= doc.scrollHeight - 2,
      navTop: Math.round(navTop),
      navHeight: navRect ? Math.round(navRect.height) : 0,
      lastBlockTag: lastContent ? lastContent.tagName : null,
      lastBlockBottom: lastRect ? Math.round(lastRect.bottom) : null,
      lastBlockClearsNav: lastRect ? lastRect.bottom <= navTop + 2 : null,
      bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
      buriedCount: buried.length,
      buried: buried.slice(0, 15),
    };
    document.documentElement.style.scrollBehavior = previous;
    return result;
  });

  all.push({ target, ...result, bottomProbe });

  await page.close();
}

await browser.close();

const { writeFileSync } = await import('node:fs');
const out = path.join(REPO, '.agents-tmp', 'ux-audit', 'dom-probe.json');
writeFileSync(out, JSON.stringify(all, null, 2), 'utf8');

for (const entry of all) {
  const b = entry.bottomProbe;
  console.log(`\n#################### ${entry.target}`);
  console.log(`gallery <img> fetchpriority attr present: ${entry.fetchAttr?.hasAttributeFetchpriority} value=${entry.fetchAttr?.attrValue} complete=${entry.fetchAttr?.complete} natural=${entry.fetchAttr?.naturalWidth}`);
  console.log(`injected widget class="${entry.tsqd?.cls}" z=${entry.tsqd?.z} rect=${JSON.stringify(entry.tsqd?.rect)}`);
  console.log(`bottom nav rect=${JSON.stringify(entry.nav?.rect)}`);
  console.log(`at max scroll: atBottom=${b.atBottom} scrollTop=${b.scrollTop} of ${b.scrollHeight - b.clientHeight}`);
  console.log(`  bottom bar: navCount=${b.navCount} descendants=${b.navDescendants} cls="${b.navCls}"`);
  console.log(`  body padding-bottom="${b.bodyPaddingBottom}" footer padding-bottom="${b.footerPaddingBottom}"`);
  console.log(`  last block: <${b.lastBlockTag}> bottom=${b.lastBlockBottom} clearsNav=${b.lastBlockClearsNav} (navTop=${b.navTop}, navHeight=${b.navHeight})`);
  console.log(`  text still covered by the bar at max scroll: ${b.coveredText.length}`);
  for (const t of b.coveredText) console.log(`    <${t.tag}> "${t.text}" ${t.top}-${t.bottom}`);
  console.log('  who receives a tap along the bar:');
  for (const h of b.tabBarTopHit) console.log(`    x=${h.x} -> <${h.tag}> .${h.cls} inBar=${h.inBar}`);
  console.log(`  controls buried under the bottom bar: ${b.buriedCount}`);
  for (const x of b.buried) console.log(`    <${x.tag}> "${x.name}" top=${x.top} bottom=${x.bottom} pos=${x.pos} :: ${x.cls}`);
  console.log(`touch targets <44px at rest: ${entry.smallCount}`);
  for (const x of entry.small.slice(0, 20)) console.log(`    ${x.w}x${x.h} <${x.tag}> "${x.name}" :: ${x.cls}`);
}
console.log('\nJSON:', out);
