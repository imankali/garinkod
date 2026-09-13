// frontend/src/utils/normalizeDigits.test.ts

import { describe, expect, it } from 'vitest';
import { toEnglishDigits, toPersianDigits } from './normalizeDigits';

describe('toPersianDigits', () => {
  it('converts every ASCII digit to its Persian form', () => {
    expect(toPersianDigits('0123456789')).toBe('۰۱۲۳۴۵۶۷۸۹');
  });

  it('leaves non-digits untouched', () => {
    expect(toPersianDigits('12:07:59')).toBe('۱۲:۰۷:۵۹');
    expect(toPersianDigits('20%')).toBe('۲۰%');
  });

  it('accepts numbers and tolerates null/undefined', () => {
    expect(toPersianDigits(42)).toBe('۴۲');
    expect(toPersianDigits(null)).toBe('');
    expect(toPersianDigits(undefined)).toBe('');
  });

  it('round-trips with toEnglishDigits', () => {
    expect(toEnglishDigits(toPersianDigits('6037991234567890'))).toBe('6037991234567890');
  });
});
