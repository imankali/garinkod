// frontend/src/components/RouteSeo.test.tsx
//
// One `<meta name="robots">` per page, and it must be the right one.
//
// The bug this guards against shipped quietly: `index.html` hardcoded
// `index,follow` and `RouteSeo` appended its own per-route value, because
// react-helmet-async only de-duplicates tags it added itself. So every page
// carried two robots tags that disagreed, and on /orders, /profile and /checkout
// the disagreement was "index this account page" next to "noindex it". A crawler
// reading both is told two opposite things about a private page.
//
// Half the test reads the HTML shell, because that is the half a component test
// would otherwise miss: jsdom starts from a blank document, so rendering RouteSeo
// alone would always show exactly one tag and always pass.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import RouteSeo from './RouteSeo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawIndexHtml = readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
// Prose in a comment may quote a tag while explaining why it is not there.
const indexHtml = rawIndexHtml.replace(/<!--[\s\S]*?-->/g, '');

/** The tags `RouteSeo` writes on every route it handles. */
const ROUTE_SEO_OWNED_NAMES = [
  'description',
  'robots',
  'twitter:card',
  'twitter:description',
  'twitter:title',
];
const ROUTE_SEO_OWNED_PROPERTIES = ['og:type', 'og:title', 'og:description', 'og:url'];

/** Collect the tags RouteSeo would put in <head> for one address. */
async function headFor(route: string): Promise<string> {
  // No `context`: without one react-helmet-async behaves like it does in a
  // browser and writes to the document, which is the only place these tags can
  // actually be counted. Each test starts from a head it cleared itself.
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[route]}>
        <RouteSeo />
      </MemoryRouter>
    </HelmetProvider>,
  );
  // Helmet writes to the document on a tick after commit, not during it.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return document.head.innerHTML;
}

/** Drop every tag the previous render left behind, so counts stay honest. */
afterEach(() => {
  document.head.querySelectorAll('meta, link[rel="canonical"], title').forEach((node) => node.remove());
});

describe('the HTML shell leaves route metadata to RouteSeo', () => {
  it.each(ROUTE_SEO_OWNED_NAMES)('index.html does not hardcode meta[name="%s"]', (name) => {
    expect(
      indexHtml.match(new RegExp(`<meta[^>]+name=["']${name}["']`, 'g')),
      'index.html duplicates a tag RouteSeo owns',
    ).toBeNull();
  });

  it.each(ROUTE_SEO_OWNED_PROPERTIES)(
    'index.html does not hardcode meta[property="%s"]',
    (property) => {
      expect(
        indexHtml.match(new RegExp(`<meta[^>]+property=["']${property}["']`, 'g')),
      ).toBeNull();
    },
  );

  it('keeps the tags no route ever varies', () => {
    // Removing these would be a different regression: a JavaScript-less scraper
    // has nothing else to read, and the share images have no dynamic source.
    expect(indexHtml).toMatch(/<meta[^>]+charset/);
    for (const kept of ['viewport', 'theme-color', 'author']) {
      expect(indexHtml, `index.html lost meta[name="${kept}"]`).toMatch(
        new RegExp(`<meta[^>]+name=["']${kept}["']`),
      );
    }
    expect(indexHtml).toMatch(/property="og:image"/);
    expect(indexHtml).toMatch(/property="og:site_name"/);
    expect(indexHtml).toMatch(/<title>/);
  });
});

describe('RouteSeo writes exactly one robots directive per route', () => {
  it('indexes a public page', async () => {
    const head = await headFor('/privacy');
    expect(head.match(/<meta[^>]*name="robots"[^>]*>/g)).toHaveLength(1);
    expect(head).toMatch(/<meta[^>]*name="robots"[^>]*content="index,follow[^"]*"/);
    // The legal hub owns the long address; the short one is an alias of it.
    expect(head).toMatch(/<link[^>]*rel="canonical"[^>]*\/legal\/privacy"/);
    expect(document.title).toContain('حریم خصوصی');
  });

  it('protects an account page', async () => {
    const head = await headFor('/orders');
    expect(head.match(/<meta[^>]*name="robots"[^>]*>/g)).toHaveLength(1);
    expect(head).toMatch(/<meta[^>]*name="robots"[^>]*content="noindex,nofollow"/);
  });

  it.each(['/checkout', '/profile', '/messages', '/poshtiban'])(
    'protects %s too',
    async (route) => {
      expect(await headFor(route)).toMatch(/<meta[^>]*name="robots"[^>]*content="noindex,nofollow"/);
    },
  );

  it('hands a dynamic detail page to its own component', async () => {
    // RouteSeo steps aside, so it must add nothing at all rather than half a set.
    expect((await headFor('/products/12')).match(/<meta[^>]*name="robots"[^>]*>/g)).toBeNull();
  });
});
