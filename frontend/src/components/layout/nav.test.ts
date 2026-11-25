// frontend/src/components/layout/nav.test.ts
//
// The navigation is the site's table of contents, and it is the one file every
// page links through. These tests hold the three properties that broke before:
// every destination is a real route in App.tsx, no destination appears twice, and
// the list stays short enough to remain a row.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { BOTTOM_NAV, FOOTER_NAV, NAV } from './nav';

const appSource = readFileSync(path.resolve(__dirname, '../../App.tsx'), 'utf8');

/** Every `path="…"` declared on a <Route> in App.tsx. */
const declaredRoutes = new Set(
  [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]),
);

/** Turns a concrete href into the route pattern that would serve it. */
function routePattern(href: string): string {
  const pathname = href.split('?')[0] ?? href;
  const segments = pathname.split('/').filter(Boolean);
  return `/${segments.map((segment) => segment).join('/')}`;
}

const allLinks = [
  ...NAV.map((item) => ({ ...item, group: 'NAV' as const })),
  ...BOTTOM_NAV.map((item) => ({ ...item, group: 'BOTTOM_NAV' as const })),
  ...FOOTER_NAV.flatMap((group) => group.items.map((item) => ({ ...item, group: 'FOOTER_NAV' as const }))),
];

describe('navigation', () => {
  it('fits in one row on a phone and a desktop', () => {
    // Nine items was the deliberate ceiling when the row was chosen over a menu.
    expect(NAV.length).toBeLessThanOrEqual(9);
    expect(BOTTOM_NAV).toHaveLength(4);
  });

  it('does not repeat a destination inside one menu', () => {
    expect(new Set(NAV.map((item) => item.to)).size).toBe(NAV.length);
    expect(new Set(BOTTOM_NAV.map((item) => item.to)).size).toBe(BOTTOM_NAV.length);
    for (const group of FOOTER_NAV) {
      expect(new Set(group.items.map((item) => item.to)).size).toBe(group.items.length);
    }
  });

  it.each(allLinks)('$group → $to is a route App.tsx actually serves', ({ to }) => {
    const pattern = routePattern(to);
    expect(declaredRoutes.has(pattern) || declaredRoutes.has(`${pattern}/`)).toBe(true);
  });

  it('has a 404 route', () => {
    expect(declaredRoutes.has('*')).toBe(true);
  });
});
