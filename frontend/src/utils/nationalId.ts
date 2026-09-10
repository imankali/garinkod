// frontend/src/utils/nationalId.ts
//
// Iranian national code (کد ملی) validation for the browser, mirroring
// `garinkood/shop/national_id.py` one rule at a time.
//
// The two files must stay in step: the server is the authority and re-checks
// everything, but a form that accepts a code the server will reject — or rejects
// a code written in Persian digits — teaches people that this field is a lottery.
// The messages below are therefore the server's own strings, so the same problem
// is described in the same words on both sides.
//
// The check itself is the published weighted-modulo rule: the first nine digits
// weighted 10..2 must leave a remainder whose complement is the tenth digit. Two
// shapes are refused before the checksum, because the checksum alone lets them
// through and the registry never issued them: ten identical digits, and a code
// padded with six copies of one leading digit (0000001234 style).

import { toEnglishDigits } from './normalizeDigits';

export const NATIONAL_ID_ERRORS = {
  blank: 'کد ملی الزامی است.',
  format: 'کد ملی باید دقیقاً ۱۰ رقم باشد و فقط رقم فارسی یا انگلیسی بپذیرد.',
  repeated: 'این کد ملی معتبر نیست (ارقام تکراری).',
  checksum: 'کد ملی صحیح نیست؛ رقم آخر را بررسی کنید.',
} as const;

/** Digits only, with Persian/Arabic-Indic numerals folded onto ASCII ones. */
export function normaliseNationalId(value: string | null | undefined): string {
  return toEnglishDigits(value).replace(/[\s-]/g, '');
}

/** Why this code cannot be used, or `''` when it can. */
export function nationalIdError(value: string | null | undefined): string {
  const code = normaliseNationalId(value);
  if (!code) return NATIONAL_ID_ERRORS.blank;
  if (!/^\d{10}$/.test(code)) return NATIONAL_ID_ERRORS.format;
  if (new Set(code).size === 1 || code.slice(0, 6) === code.slice(0, 1).repeat(6)) {
    return NATIONAL_ID_ERRORS.repeated;
  }
  const digits = code.split('').map(Number);
  const control = digits[9] ?? -1;
  let total = 0;
  for (let index = 0; index < 9; index += 1) {
    total += (digits[index] ?? 0) * (10 - index);
  }
  const remainder = total % 11;
  const expected = remainder < 2 ? remainder : 11 - remainder;
  return control === expected ? '' : NATIONAL_ID_ERRORS.checksum;
}

export function isValidNationalId(value: string | null | undefined): boolean {
  return nationalIdError(value) === '';
}

/**
 * A display-safe form of the code, matching `mask_national_id` on the server:
 * `0079584381` → `007*****381`. Used where an owner recognises their own code
 * without the page repeating a national identifier in plaintext.
 */
export function maskNationalId(value: string | null | undefined): string {
  const code = normaliseNationalId(value);
  if (code.length !== 10) return '';
  return `${code.slice(0, 3)}*****${code.slice(9)}`;
}
