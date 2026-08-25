// frontend/src/utils/normalizeDigits.ts
//
// Normalises Persian and Arabic-Indic digits to ASCII (0-9).
//
// Farmers often enter phone numbers, farm areas, quantities, and order codes
// with Persian or Arabic keyboards ('۱۲۳۴' or '١٢٣٤'). Normalising digits
// ensures client-side validation and API submissions stay consistently valid.

/**
 * Convert any Persian (۰-۹) or Arabic-Indic (٠-٩) digits in a string to standard 0-9.
 */
export function toEnglishDigits(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

/**
 * Normalise a phone number: convert digits to ASCII and remove non-digit characters (except leading +).
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  const english = toEnglishDigits(phone);
  return english.replace(/[^\d+]/g, '');
}

/**
 * Normalise general numeric inputs (area, price, quantity, postal code).
 * When `allowDecimal` is true, keeps one decimal point.
 */
export function normalizeNumericInput(value: string | null | undefined, allowDecimal = false): string {
  const english = toEnglishDigits(value).replace(/,/g, '');
  if (allowDecimal) {
    // Keep digits and at most one decimal point
    const cleaned = english.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return `${parts[0]}.${parts.slice(1).join('')}`;
    }
    return cleaned;
  }
  return english.replace(/\D/g, '');
}
