// frontend/src/config/navigation.ts
//
// One source of truth for every destination in the app.
//
// Before this file existed, five routes (/profile, /rewards, /affiliate,
// /finance, /studio, /support) had no link anywhere in the interface — they
// were reachable only by typing the URL. Any new route added to App.tsx should
// be added here too, and it will then appear in the header, the mobile menu,
// the account menu and the footer automatically.

import {
  BadgePercent,
  BookOpen,
  Building2,
  Calculator,
  ClipboardList,
  Gift,
  Handshake,
  Heart,
  Home,
  Landmark,
  LayoutGrid,
  LifeBuoy,
  type LucideIcon,
  Mail,
  MessageCircle,
  Newspaper,
  Package,
  PhoneCall,
  Camera,
  ShieldCheck,
  Sprout,
  Store,
  Tractor,
  UserRound,
  Users,
} from 'lucide-react';

import { USER_LEVEL, type UserLevel } from '../types';

export interface NavItem {
  /** Stable key, also used as the React key. */
  id: string;
  label: string;
  /** Short description shown in menus that have room for it. */
  description?: string;
  to: string;
  icon: LucideIcon;
  /** Minimum access level; omitted means everyone, including signed-out. */
  minLevel?: UserLevel;
  /** Requires a signed-in user but no particular level. */
  requiresAuth?: boolean;
  /** Show in the primary desktop navigation bar. */
  primary?: boolean;
  /** Show in the mobile bottom bar (max four plus the cart). */
  mobileBar?: boolean;
  /**
   * Some destinations are dialogs rather than pages (the wishlist). Menus that
   * can open the dialog treat the item as a button; others fall back to `to`.
   */
  action?: 'wishlist';
}

export interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

/** Shopping and browsing — available to everyone. */
export const SHOP_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'خانه',
    description: 'صفحه اصلی فروشگاه',
    to: '/',
    icon: Home,
    primary: true,
    mobileBar: true,
  },
  {
    id: 'products',
    label: 'محصولات',
    description: 'کود، سم، بذر و ادوات',
    to: '/products',
    icon: LayoutGrid,
    primary: true,
    mobileBar: true,
  },
  {
    id: 'marketplace',
    label: 'بازار کشاورزان',
    description: 'خرید مستقیم از غرفه‌داران',
    to: '/marketplace',
    icon: Tractor,
    primary: true,
    mobileBar: true,
  },
  {
    id: 'storefronts',
    label: 'غرفه‌داران',
    description: 'فهرست کامل فروشندگان',
    to: '/storefronts',
    icon: Store,
    primary: true,
  },
  {
    id: 'services',
    label: 'خدمات کشاورزی',
    description: 'مشاوره، آبیاری و آزمون خاک',
    to: '/services',
    icon: Sprout,
    primary: true,
  },
  {
    id: 'offers',
    label: 'تخفیف‌ها',
    description: 'محصولات ویژه و شگفت‌انگیز',
    to: '/products?featured=true',
    icon: BadgePercent,
  },
];

/**
 * Everything tied to the signed-in user's own account.
 *
 * Ordered by how often people reach for each one (the convention most apps
 * follow): identity first, then the two things they check daily — messages
 * and saved items — then purchase history, then the perks.
 */
export const ACCOUNT_ITEMS: NavItem[] = [
  {
    id: 'profile',
    label: 'حساب من',
    description: 'اطلاعات شخصی و نشانی',
    to: '/profile',
    icon: UserRound,
    requiresAuth: true,
    mobileBar: true,
  },
  {
    id: 'messages',
    label: 'پیام‌ها',
    description: 'گفتگو با غرفه‌داران و پشتیبانی',
    to: '/messages',
    icon: MessageCircle,
  },
  {
    id: 'wishlist',
    label: 'علاقه‌مندی‌ها',
    description: 'محصولات نشان‌شده',
    // Opened as a dialog by the menus; the catalogue is the fallback route.
    to: '/products',
    icon: Heart,
    /** Rendered as an action (opens the wishlist dialog), not a plain link. */
    action: 'wishlist',
  },
  {
    id: 'orders',
    label: 'سفارش‌ها',
    description: 'پیگیری و تاریخچه خرید',
    to: '/orders',
    icon: Package,
  },
  {
    id: 'rewards',
    label: 'باشگاه مشتریان',
    description: 'کد تخفیف و کیف پول',
    to: '/rewards',
    icon: Gift,
    requiresAuth: true,
  },
  {
    id: 'affiliate',
    label: 'همکاری در فروش',
    description: 'درآمد از معرفی مشتری',
    to: '/affiliate',
    icon: Handshake,
    requiresAuth: true,
  },
];

/** Seller tools — level 2 and above. */
export const SELLER_ITEMS: NavItem[] = [
  {
    id: 'sell',
    label: 'فروش محصول',
    description: 'ثبت درخواست خرید محصول شما',
    to: '/farmer-sell',
    icon: Building2,
  },
  {
    id: 'studio',
    label: 'استودیو غرفه',
    description: 'پست، استوری و هایلایت',
    to: '/studio',
    icon: Camera,
    minLevel: USER_LEVEL.SELLER,
  },
  {
    id: 'finance',
    label: 'دفتر مالی',
    description: 'موجودی، کمیسیون و تسویه',
    to: '/finance',
    icon: Landmark,
    minLevel: USER_LEVEL.SELLER,
  },
];

/** Staff console — level 3 and above. */
export const STAFF_ITEMS: NavItem[] = [
  {
    id: 'management',
    label: 'مرکز مدیریت',
    description: 'بررسی محتوا، سفارش و کاربران',
    to: '/poshtiban',
    icon: ShieldCheck,
    minLevel: USER_LEVEL.MODERATOR,
  },
  {
    id: 'farmers',
    label: 'پشتیبانی کشاورزان',
    description: 'درخواست مشاوره، پرونده زمین‌ها و تقویم کشاورزی',
    to: '/farmers',
    icon: Sprout,
    minLevel: USER_LEVEL.MODERATOR,
  },
];

/** Help and tools — always available. */
export const SUPPORT_ITEMS: NavItem[] = [
  {
    id: 'support',
    label: 'پشتیبانی و شکایات',
    description: 'ثبت بازخورد یا شکایت از غرفه',
    to: '/support',
    icon: LifeBuoy,
  },
  {
    id: 'order-tracking',
    label: 'پیگیری سفارش',
    description: 'با کد سفارش و شماره تماس',
    to: '/orders',
    icon: ClipboardList,
  },
  {
    id: 'calculator',
    label: 'محاسبه‌گر کود و سم',
    description: 'مقدار مصرف بر اساس سطح زمین',
    to: '/#agri-calculator',
    icon: Calculator,
  },
];

/**
 * Knowledge and trust pages.
 *
 * These are the pages a wholesale buyer reads before transferring money — the
 * growing guide for the crop they are about to plant, the team behind the
 * shipment and the number to call when a carton arrives damaged.
 */
export const KNOWLEDGE_ITEMS: NavItem[] = [
  {
    id: 'blog',
    label: 'بلاگ گرین کود',
    description: 'مقاله تخصصی، اخبار قیمت و گزارش بازار نهاده',
    to: '/blog',
    icon: Newspaper,
  },
  {
    id: 'guides',
    label: 'راهنمای کشت گیاهان',
    description: 'از آماده‌سازی بستر تا برداشت، برای هر محصول',
    to: '/guides',
    icon: BookOpen,
  },
  {
    id: 'about',
    label: 'درباره گرین کود',
    description: 'تیم، برندها و قراداد ما با کشاورز',
    to: '/about',
    icon: Users,
  },
  {
    id: 'contact',
    label: 'تماس با ما',
    description: 'شماره‌ها، نشانی، ساعات کاری و پیام‌رسان‌ها',
    to: '/contact',
    icon: PhoneCall,
  },
  {
    id: 'newsletter',
    label: 'خبرنامه هفتگی',
    description: 'قیمت نهاده، موجودی تازه و راهنمای فصل',
    to: '/newsletter',
    icon: Mail,
  },
];

export const NAV_SECTIONS: NavSection[] = [
  { id: 'shop', title: 'فروشگاه', items: SHOP_ITEMS },
  { id: 'knowledge', title: 'بلاگ و راهنما', items: KNOWLEDGE_ITEMS },
  { id: 'account', title: 'حساب کاربری', items: ACCOUNT_ITEMS },
  { id: 'seller', title: 'فروشندگان', items: SELLER_ITEMS },
  { id: 'support', title: 'راهنما و پشتیبانی', items: SUPPORT_ITEMS },
  { id: 'staff', title: 'مدیریت', items: STAFF_ITEMS },
];

/**
 * Filter a list to what the current viewer may actually open.
 *
 * Hiding a link the user cannot use is kinder than showing one that bounces
 * them to a login page — but only for privileged destinations. Items that
 * merely `requiresAuth` stay visible when signed out so a visitor can discover
 * the feature and be prompted to sign in.
 */
export function visibleItems(
  items: NavItem[],
  { level, isAuthenticated }: { level: number; isAuthenticated: boolean },
): NavItem[] {
  return items.filter((item) => {
    if (item.minLevel && level < item.minLevel) return false;
    if (item.requiresAuth && !isAuthenticated) return false;
    return true;
  });
}

/** Sections with their items filtered, dropping any section left empty. */
export function visibleSections(context: {
  level: number;
  isAuthenticated: boolean;
}): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: visibleItems(section.items, context),
  })).filter((section) => section.items.length > 0);
}

/** The four destinations pinned to the mobile bottom bar. */
export const MOBILE_BAR_ITEMS: NavItem[] = [...SHOP_ITEMS, ...ACCOUNT_ITEMS].filter(
  (item) => item.mobileBar,
);

/** The primary desktop navigation row. */
export const PRIMARY_ITEMS: NavItem[] = SHOP_ITEMS.filter((item) => item.primary);
