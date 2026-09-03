import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'گرین کود';
const DEFAULT_DESCRIPTION = 'خرید کود، سم، بذر و تجهیزات کشاورزی، خدمات مزرعه و بازار غرفه‌های بررسی‌شده.';

const ROUTES: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'گرین کود | فروشگاه تخصصی نهاده‌های کشاورزی',
    description: DEFAULT_DESCRIPTION,
  },
  '/products': {
    title: 'محصولات و نهاده‌های کشاورزی | گرین کود',
    description: 'مشاهده و مقایسه کود، سم، بذر و تجهیزات کشاورزی با موجودی و قیمت به‌روز.',
  },
  '/marketplace': {
    title: 'بازار کشاورزان و غرفه‌ها | گرین کود',
    description: 'آگهی‌های کشاورزی و محصولات غرفه‌های بررسی‌شده را مشاهده کنید.',
  },
  '/storefronts': {
    title: 'فهرست غرفه‌های کشاورزی | گرین کود',
    description: 'غرفه‌های فروشندگان و کشاورزان عضو گرین کود را بررسی کنید.',
  },
  '/services': {
    title: 'خدمات و مشاوره کشاورزی | گرین کود',
    description: 'برای مشاوره زراعی، آبیاری، خاک، گلخانه و ماشین‌آلات درخواست ثبت کنید.',
  },
  '/farmer-sell': {
    title: 'فروش محصول کشاورز | گرین کود',
    description: 'درخواست تأمین و فروش محصول کشاورزی خود را برای بررسی ثبت کنید.',
  },
  '/support': {
    title: 'پشتیبانی و رسیدگی به شکایت | گرین کود',
    description: 'پرسش، پیشنهاد یا شکایت خود را برای تیم پشتیبانی گرین کود ارسال کنید.',
  },
  '/privacy': {
    title: 'حریم خصوصی و حفاظت از داده‌ها | گرین کود',
    description: 'نحوه پردازش، نگهداری و حفاظت از اطلاعات کاربران در گرین کود.',
  },
  '/terms': {
    title: 'شرایط استفاده و ثبت سفارش | گرین کود',
    description: 'شرایط استفاده از خدمات، حساب کاربری و ثبت سفارش در گرین کود.',
  },
  '/returns': {
    title: 'لغو، مرجوعی و بازگشت وجه | گرین کود',
    description: 'راهنمای لغو سفارش، مرجوعی کالا و بازگشت وجه در گرین کود.',
  },
};

const PRIVATE_PREFIXES = [
  '/checkout', '/orders', '/profile', '/messages', '/studio', '/poshtiban',
  '/management', '/farmers', '/finance', '/rewards', '/affiliate', '/login',
];

export default function RouteSeo() {
  const location = useLocation();
  // Dynamic detail pages own their entity-specific metadata and structured data.
  if (/^\/(products|storefronts)\/[^/]+$/.test(location.pathname)) return null;

  const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
  const route = ROUTES[location.pathname] || {
    title: `${SITE_NAME} | خدمات کشاورزی`,
    description: DEFAULT_DESCRIPTION,
  };
  const category = location.pathname === '/products'
    ? new URLSearchParams(location.search).get('category')
    : null;
  const canonicalPath = category
    ? `/products?category=${encodeURIComponent(category)}`
    : location.pathname;
  const canonical = `${siteUrl}${canonicalPath}`;
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));

  return (
    <Helmet>
      <title>{route.title}</title>
      <meta name="description" content={route.description} />
      <meta name="robots" content={isPrivate ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={route.title} />
      <meta property="og:description" content={route.description} />
      <meta property="og:url" content={canonical} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={route.title} />
      <meta name="twitter:description" content={route.description} />
    </Helmet>
  );
}
