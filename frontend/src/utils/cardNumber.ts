// frontend/src/utils/cardNumber.ts
//
// The same three rules the backend applies in shop/cards.py, mirrored so the
// form can answer while the person types: normalise Persian digits, demand
// sixteen of them, and never display more than the last four.

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeCardNumber(value: string): string {
  let out = '';
  for (const char of (value || '').trim()) {
    if (char >= '0' && char <= '9') out += char;
    else {
      const fa = FA_DIGITS.indexOf(char);
      const ar = AR_DIGITS.indexOf(char);
      if (fa > -1) out += String(fa);
      else if (ar > -1) out += String(ar);
    }
  }
  return out;
}

export function cardNumberError(value: string): string {
  const cleaned = normalizeCardNumber(value);
  if (!cleaned) return '';
  if (cleaned.length !== 16) return 'شماره کارت باید ۱۶ رقم باشد.';
  return '';
}

export function isValidCardNumber(value: string): boolean {
  return normalizeCardNumber(value).length === 16;
}

export function maskCardNumber(value: string): string {
  const cleaned = normalizeCardNumber(value);
  if (cleaned.length !== 16) return '';
  return `****-****-****-${cleaned.slice(-4)}`;
}
