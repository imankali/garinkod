// frontend/src/utils/formatPrice.test.ts
//
// A receipt must render even when an amount is missing.
//
// `formatPrice(undefined)` used to throw, and the throw landed in the render of
// the order confirmation — the one screen a buyer cannot reload their way out of,
// because the order already exists. Every caller of this helper reads a field the
// API may legitimately omit, so the tolerance is asserted here rather than left
// to whichever screen hits it first.

import { describe, expect, it } from 'vitest';

import { calculateDiscount, formatPrice, formatPriceOnly } from './formatPrice';

describe('formatPrice', () => {
  it('formats a real amount in Persian', () => {
    expect(formatPrice(385000)).toMatch(/تومان$/);
    expect(formatPrice(0)).toContain('۰');
  });

  it.each([undefined, null, Number.NaN])('survives %s instead of throwing', (value) => {
    expect(() => formatPrice(value as never)).not.toThrow();
    expect(formatPrice(value as never)).toBe('— تومان');
    expect(formatPriceOnly(value as never)).toBe('—');
  });
});

describe('calculateDiscount', () => {
  it('guards against a zero original price', () => {
    expect(calculateDiscount(0, 0)).toBe(0);
  });
});
