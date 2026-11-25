// frontend/src/components/layout/nav.ts
//
// The whole site's navigation, in one list.
//
// Nine destinations is what the platform actually offers a visitor who is not
// signed in. They fit in one row on desktop and one scrollable row on a phone,
// which is the point: a mega-menu was hiding nine links behind a grid of icons
// and three levels of hover. If a tenth destination is added, the test in
// `nav.test.ts` fails and forces a decision rather than a silent overflow.

export interface NavItem {
  to: string;
  label: string;
}

/** Primary navigation. Order is the order a buyer moves through the site. */
export const NAV: ReadonlyArray<NavItem> = [
  { to: '/products', label: 'فروشگاه' },
  { to: '/storefronts', label: 'بازار کشاورزان' },
  { to: '/offers', label: 'تخفیف‌ها' },
  { to: '/services', label: 'خدمات کشاورزی' },
  { to: '/magazine', label: 'مجله' },
  { to: '/farmers', label: 'فروش محصول' },
  { to: '/track', label: 'پیگیری سفارش' },
  { to: '/support', label: 'پشتیبانی' },
  { to: '/about', label: 'درباره ما' },
] as const;

/** The mobile bar: four places plus the cart, which the header owns. */
export const BOTTOM_NAV: ReadonlyArray<NavItem> = [
  { to: '/products', label: 'فروشگاه' },
  { to: '/storefronts', label: 'بازار' },
  { to: '/offers', label: 'تخفیف‌ها' },
  { to: '/account', label: 'حساب' },
] as const;

/** Groups used by the footer. Each item must exist as a real route. */
export const FOOTER_NAV: ReadonlyArray<{ title: string; items: ReadonlyArray<NavItem> }> = [
  {
    title: 'خرید',
    items: [
      { to: '/products', label: 'همهٔ کالاها' },
      { to: '/offers', label: 'تخفیف‌های فعال' },
      { to: '/storefronts', label: 'غرفه‌داران' },
      { to: '/brands', label: 'برندها' },
    ],
  },
  {
    title: 'خدمات',
    items: [
      { to: '/services', label: 'خدمات مزرعه' },
      { to: '/farm', label: 'زمین‌ها و تقویم کشت' },
      { to: '/calculator', label: 'ماشین‌حساب کود و سم' },
      { to: '/photo-check', label: 'بررسی عکس برگ' },
      { to: '/farmers', label: 'فروش محصول' },
      { to: '/track', label: 'پیگیری سفارش' },
      { to: '/support', label: 'پشتیبانی' },
    ],
  },
  {
    title: 'گرین‌کود',
    items: [
      { to: '/about', label: 'دربارهٔ ما' },
      { to: '/magazine', label: 'مجله' },
      { to: '/contact', label: 'تماس با ما' },
      { to: '/legal', label: 'اسناد حقوقی' },
    ],
  },
] as const;
