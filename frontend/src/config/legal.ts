// frontend/src/config/legal.ts
//
// The legal documents that get a place in the furniture of the site — the
// footer row and the acceptance line at checkout.
//
// The full set lives on the server (`shop/legal.py`) and is listed at /legal, so
// this short list only names the documents a buyer is expected to reach without
// thinking: what they agree to, what happens to their data, and how a purchase
// is undone. Keeping it here rather than inline means the footer and the
// checkout can never cite different addresses for the same promise.

export const LEGAL_CORE_LINKS: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/legal/terms', label: 'قوانین و مقررات' },
  { to: '/legal/privacy', label: 'حریم خصوصی' },
  { to: '/legal/returns', label: 'شرایط خرید و بازگشت کالا' },
];

export const LEGAL_HUB_LINK = { to: '/legal', label: 'همه اسناد حقوقی' };
