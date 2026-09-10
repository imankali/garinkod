// frontend/src/config/navigation.test.ts
//
// The merge of بازار کشاورزان into غرفه‌داران was a product decision, and the
// place it can quietly rot back is this file: a stale `/marketplace` link buried
// in a footer section, or the sellers\' destination dropped out of the mobile bar
// because someone reordered the flags. These are the invariants, not a snapshot.

import { describe, expect, it } from 'vitest';

import {
  MOBILE_BAR_ITEMS,
  NAV_SECTIONS,
  PRIMARY_ITEMS,
  SHOP_ITEMS,
  visibleSections,
} from './navigation';

const ALL_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

describe('the marketplace merge', () => {
  it('links to nothing that redirects', () => {
    expect(ALL_ITEMS.filter((item) => item.to.startsWith('/marketplace'))).toEqual([]);
  });

  it('offers the sellers\' page exactly once, and calls it غرفه‌داران', () => {
    const hits = ALL_ITEMS.filter((item) => item.to === '/storefronts');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.label).toBe('غرفه‌داران');
    expect(hits[0]?.id).toBe('storefronts');
  });

  it('keeps that page on both bars a hand uses', () => {
    expect(SHOP_ITEMS.filter((item) => item.id === 'storefronts')[0]).toMatchObject({
      primary: true,
      mobileBar: true,
    });
  });
});

describe('bar budgets', () => {
  it('never overflows the mobile bar', () => {
    // Four destinations plus the cart is what fits a phone without wrapping.
    expect(MOBILE_BAR_ITEMS.length).toBeLessThanOrEqual(4);
    expect(new Set(MOBILE_BAR_ITEMS.map((item) => item.to)).size).toBe(MOBILE_BAR_ITEMS.length);
  });

  it('keeps the primary desktop row short enough to read at a glance', () => {
    expect(PRIMARY_ITEMS.length).toBeLessThanOrEqual(6);
  });

  it('uses each address once per bar', () => {
    const ids = ALL_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('who may see what', () => {
  it('shows the studio door to a signed-out visitor, so they can find it', () => {
    const studio = ALL_ITEMS.find((item) => item.to === '/studio');
    expect(studio).toBeDefined();
    // The page itself resolves the three cases (log in, build a stall, open it),
    // which is why the nav item must not gate on level or session.
    expect(studio).not.toHaveProperty('minLevel');
    expect(studio?.requiresAuth).toBeFalsy();
  });

  it('keeps explore public and staff-only work hidden from a buyer', () => {
    const sections = visibleSections({ level: 1, isAuthenticated: true });
    const sellerItems = sections.flatMap((section) => section.items);
    expect(sellerItems.some((item) => item.to === '/explore')).toBe(true);
    expect(sellerItems.some((item) => item.to === '/poshtiban')).toBe(false);
  });

  it('drops a whole section once its privileged items are filtered out', () => {
    const sections = visibleSections({ level: 0, isAuthenticated: false });
    expect(sections.map((section) => section.id)).not.toContain('staff');
    expect(sections.map((section) => section.id)).toContain('shop');
  });
});
