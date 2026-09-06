// frontend/src/utils/slugify.ts
//
// Client mirror of the backend's slugify_fa (shop/slugs.py), used to give every
// article heading an `id` that matches what the API publishes in `headings`.
// If the two ever disagree, the table of contents stops scrolling — so the
// rules are kept side by side here and in the Python module.

const FOLD: Record<string, string> = {
  ي: 'ی',
  ك: 'ک',
  ۀ: 'ه',
  ة: 'ه',
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  '\u200c': '-', // zero-width non-joiner
  '\u200f': '', // right-to-left mark
  '\u200e': '', // left-to-right mark
  _: '-',
};

export function slugifyClient(value: string): string {
  if (!value) return '';
  const folded = value
    .trim()
    .replace(/[يكۀأةإآ_\u200c\u200f\u200e]/g, (char) => FOLD[char] ?? char)
    .replace(/\s+/g, '-')
    .normalize('NFKC')
    .toLowerCase()
    // Keep letters, digits, underscore and hyphen — the same set Django's
    // unicode slugify keeps.
    // Python's \w also keeps '_' — mirror it so the two can never disagree.
    .replace(/[^\p{L}\p{N}_\s-]/gu, '');
  const slug = folded.replace(/[-\s]+/g, '-').replace(/^[-_]+|[-_]+$/g, '');
  return slug.slice(0, 180);
}
