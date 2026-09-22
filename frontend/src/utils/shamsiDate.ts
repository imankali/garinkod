// frontend/src/utils/shamsiDate.ts
//
// One Shamsi (Jalali) date formatter for the whole site.
//
// Every locale string in the codebase was already `fa-IR`, and Node/browser
// ICU resolves `fa-IR` to the Persian (Solar Hijri) calendar by default — the
// live check returned «۳۱ شهریور ۱۴۰۵». Centralising it guarantees that stays
// true in one place: if a browser ever disagrees, the calendar is pinned here
// with the explicit `fa-IR-u-ca-persian` unicode extension, and every page
// inherits the fix.
//
// Dates only (no clock): a storefront cares that a harvest happened in
// «مرداد», not at 14:03.

type ShamsiStyle = 'long' | 'medium' | 'short';

const OPTIONS: Record<ShamsiStyle, Intl.DateTimeFormatOptions> = {
  // «۳۱ شهریور ۱۴۰۵» — for facts that persist (تولید، انقضا، برداشت).
  long: { year: 'numeric', month: 'long', day: 'numeric' },
  // «۳۱ شهریور» — for facts where the year is the current one by context.
  medium: { month: 'long', day: 'numeric' },
  // «۱۴۰۵/۷/۳۱» — for dense tables.
  short: { year: 'numeric', month: 'numeric', day: 'numeric' },
};

/** ISO date or datetime string → «۳۱ شهریور ۱۴۰۵» in the Persian calendar. */
export function formatShamsi(value: string | Date | null | undefined, style: ShamsiStyle = 'long'): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', OPTIONS[style]).format(date);
}

/** An `<input type="date">` value (ISO yyyy-mm-dd) → Shamsi text under it. */
export function shamsiHint(iso: string | null | undefined, style: ShamsiStyle = 'long'): string {
  const formatted = formatShamsi(iso, style);
  return formatted ? `معادل شمسی: ${formatted}` : '';
}
