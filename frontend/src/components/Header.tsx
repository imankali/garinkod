// frontend/src/components/Header.tsx

import { memo, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import {
  Gift,
  Heart,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Package,
  ShoppingCart,
  Store,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { PRIMARY_ITEMS, SELLER_ITEMS, STAFF_ITEMS, visibleItems, type NavItem } from "../config/navigation";
import { useAuthStore, useUserLevel } from "../store/authStore";
import TopBar from "./TopBar";
import Logo from "./Logo";
import MegaMenu from "./MegaMenu";
import SearchBar from "./SearchBar";
import MobileMenu from "./MobileMenu";
import CartDrawer from "./CartDrawer";
import { useCartStore } from "../store/cartStore";
import { messagesApi } from "../api/services";
import { useTranslation } from "../i18n";

// ========================================
// Constants
// ========================================
const SPRING = { type: "spring", damping: 28, stiffness: 320, mass: 0.6 } as const;
const SPRING_SOFT = { type: "spring", damping: 22, stiffness: 260 } as const;

/** Nav labels come from the dictionaries when available. */
function navLabel(t: (key: string) => string, item: NavItem): string {
  const key = `nav.${item.id}`;
  const translated = t(key);
  return translated === key ? item.label : translated;
}

// ========================================
// ✅ Animated Number - انیمیشن flip برای تغییر عدد
// ========================================
const AnimatedCount = memo(function AnimatedCount({ value }: { value: number }) {
  return (
    <span className="relative inline-flex h-full w-full items-center justify-center overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ ...SPRING, damping: 20 }}
        >
          {value > 99 ? "۹۹+" : value.toLocaleString("fa-IR")}
        </motion.span>
      </AnimatePresence>
    </span>
  );
});

// ========================================
// ✅ Cart Button - خارج از Header تا remount نشود
// ========================================
interface CartButtonProps {
  mobile?: boolean;
  count: number;
  bump: boolean;
  isOpen: boolean;
  onOpen: () => void;
}

const CartButton = memo(function CartButton({
  mobile = false,
  count,
  bump,
  isOpen,
  onOpen,
}: CartButtonProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      id={mobile ? "cart-icon-target-mobile" : "cart-icon-target"}
      onClick={onOpen}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.05, y: -1 }}
      whileTap={{ scale: 0.93 }}
      transition={SPRING}
      className={`group relative flex items-center gap-1.5 overflow-hidden rounded-xl bg-brand-gradient-accent text-white shadow-md shadow-emerald-200 transition-shadow duration-300 hover:shadow-xl hover:shadow-emerald-300/50 dark:shadow-emerald-950/50 ${
        mobile
          ? "h-9 w-9 justify-center px-0"
          : "h-9 px-2.5 sm:h-10 sm:gap-2 sm:px-3 md:px-4"
      }`}
      aria-label={`سبد خرید${count > 0 ? ` - ${count} کالا` : ""}`}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
    >
      {/* Shimmer روی hover */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -translate-x-full bg-gradient-to-l from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />

      {/* Glow pulse وقتی آیتم اضافه می‌شود */}
      <AnimatePresence>
        {bump && !prefersReducedMotion && (
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 rounded-xl bg-white/40"
          />
        )}
      </AnimatePresence>

      <span className="relative flex items-center">
        {/* آیکون با انیمیشن bump */}
        <motion.span
          animate={
            bump && !prefersReducedMotion
              ? { rotate: [0, -18, 14, -8, 4, 0], scale: [1, 1.35, 1.1, 1] }
              : { rotate: 0, scale: 1 }
          }
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="flex"
        >
          <ShoppingCart
            size={mobile ? 17 : 18}
            className={mobile ? "" : "sm:h-5 sm:w-5"}
            aria-hidden="true"
          />
        </motion.span>

        {/* Badge با انیمیشن spring + flip عدد */}
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ ...SPRING_SOFT, damping: 15 }}
              className={`absolute flex items-center justify-center rounded-full bg-white font-bold text-[#0F8A5F] shadow ring-2 ring-emerald-500/20 ${
                mobile
                  ? "-end-2 -top-2.5 h-4 min-w-4 px-0.5 text-fluid-2xs"
                  : "-end-2 -top-2.5 h-4 min-w-4 px-0.5 text-fluid-2xs sm:-end-2.5 sm:-top-3 sm:h-5 sm:min-w-5 sm:text-fluid-2xs"
              }`}
            >
              <AnimatedCount value={count} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      {/* متن - فقط دسکتاپ */}
      {!mobile && (
        <span className="relative hidden text-xs font-semibold md:inline md:text-sm">
          سبد خرید
        </span>
      )}
    </motion.button>
  );
});

// ========================================
// ✅ Icon Button قابل استفاده مجدد
// ========================================
const IconButton = memo(function IconButton({
  onClick,
  label,
  className = "",
  children,
  rotateOnHover = false,
}: {
  onClick?: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
  rotateOnHover?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.button
      onClick={onClick}
      whileHover={
        prefersReducedMotion
          ? undefined
          : { scale: 1.08, rotate: rotateOnHover ? 12 : 0, y: -1 }
      }
      whileTap={{ scale: 0.9 }}
      transition={SPRING}
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-200 sm:h-10 sm:w-10 ${className}`}
      title={label}
      aria-label={label}
    >
      {children}
    </motion.button>
  );
});

// ========================================
// ✅ Nav Link با underline هوشمند (layoutId)
// ========================================
const DesktopNav = memo(function DesktopNav() {
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  // The router's location, not window.location: reading the global directly
  // meant the active link never updated during client-side navigation.
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuthStore();
  const level = useUserLevel();
  const { t } = useTranslation();

  // Primary destinations plus whatever this viewer is entitled to see, so a
  // seller or moderator reaches their console without hunting for it.
  const contextualItems = visibleItems(
    [...SELLER_ITEMS, ...STAFF_ITEMS],
    { level, isAuthenticated },
  ).filter((item) => item.minLevel);

  return (
    <nav
      className="hidden border-t border-emerald-50 bg-gradient-to-l from-emerald-50/40 via-white to-[#F7F3E8] dark:border-emerald-900/50 dark:from-emerald-950/40 dark:via-[#052e22] dark:to-emerald-950/30 lg:block"
      aria-label="ناوبری اصلی"
    >
      <ul
        className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4"
        onMouseLeave={() => setHoveredHref(null)}
      >
        {PRIMARY_ITEMS.map((item) => {
          const base = item.to.split("?")[0]!;
          const isActive = base === "/" ? pathname === "/" : pathname.startsWith(base);
          const showUnderline = hoveredHref === item.to || (!hoveredHref && isActive);

          return (
            <li key={item.id} className="relative">
              <Link
                to={item.to}
                onMouseEnter={() => setHoveredHref(item.to)}
                onFocus={() => setHoveredHref(item.to)}
                className={`relative flex min-h-11 items-center px-3.5 text-fluid-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "text-[#0F8A5F] dark:text-lime-300"
                    : "text-slate-600 hover:text-[#0F8A5F] dark:text-emerald-100 dark:hover:text-lime-300"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {navLabel(t, item)}
                {showUnderline && (
                  <motion.span
                    layoutId="nav-underline"
                    transition={SPRING}
                    className="absolute inset-x-3 bottom-1.5 h-0.5 rounded-full bg-brand-gradient-accent"
                  />
                )}
              </Link>
            </li>
          );
        })}

        {/* Role-specific shortcuts, visually separated from the shop links. */}
        {contextualItems.length > 0 && (
          <li aria-hidden="true" className="mx-1 h-5 w-px bg-emerald-200 dark:bg-emerald-800" />
        )}
        {contextualItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.to);
          return (
            <li key={item.id}>
              <Link
                to={item.to}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-fluid-xs font-bold transition-colors ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "text-emerald-700 hover:bg-emerald-100 dark:text-lime-300 dark:hover:bg-emerald-900"
                }`}
              >
                <Icon size={14} aria-hidden="true" />
                {navLabel(t, item)}
              </Link>
            </li>
          );
        })}

        <li className="ms-auto hidden items-center gap-1.5 py-1 text-fluid-2xs font-semibold text-[#0F8A5F] dark:text-lime-300 xl:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          کارشناسان آنلاین: پاسخگویی ۲ ساعته
        </li>
      </ul>
    </nav>
  );
});

// ========================================
// ✅ منوی «بیشتر» دسکتاپ: شب، پیام‌ها و حساب کاربری
// ========================================
function MoreMenu({ isDark, onToggleDark }: { isDark: boolean; onToggleDark: () => void }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  // Live unread count for the direct-messages shortcut.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const refresh = () =>
      messagesApi
        .conversations()
        .then((response) => {
          if (!cancelled) setUnread(response.data.unread_total || 0);
        })
        .catch(() => undefined);
    void refresh();
    const interval = setInterval(() => void refresh(), 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username;

  async function signOut() {
    setOpen(false);
    await logout();
    navigate("/");
  }

  const items = [
    { icon: MessageCircle, label: t("nav.messages"), desc: t("direct.title"), href: "/messages" },
    { icon: UserRound, label: t("nav.profile"), desc: t("account.title"), href: "/profile" },
    { icon: Package, label: t("nav.orders"), desc: t("account.orders"), href: "/orders" },
    { icon: Store, label: t("account.seller"), desc: t("account.sellerDescription"), href: "/profile?tab=seller" },
    { icon: Gift, label: t("nav.offers"), desc: "Rewards", href: "/rewards" },
  ];

  return (
    <div ref={ref} className="relative">
      <IconButton
        onClick={() => setOpen((current) => !current)}
        label={t("nav.more")}
        rotateOnHover
        className={`text-slate-500 hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-900/50 ${open ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/60" : ""}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "close" : "more"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex"
          >
            {open ? <X size={18} /> : <MoreHorizontal size={18} />}
          </motion.span>
        </AnimatePresence>
      </IconButton>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={SPRING_SOFT}
            className="absolute end-0 top-[calc(100%+10px)] z-50 w-72 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-900/10 dark:border-emerald-800 dark:bg-emerald-950"
            role="menu"
            aria-label={t("nav.more")}
          >
            {/* Theme */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onToggleDark();
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-start text-sm font-bold text-slate-700 transition-colors hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/60"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
                {isDark ? <Sun size={17} /> : <Moon size={17} />}
              </span>
              <span className="flex-1">{isDark ? t("header.themeToLight") : t("header.themeToDark")}</span>
              <span
                aria-hidden="true"
                className={`relative h-5 w-9 rounded-full transition-colors ${isDark ? "bg-emerald-600" : "bg-slate-300"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${isDark ? "start-[18px]" : "start-0.5"}`}
                />
              </span>
            </button>

            <div className="mx-4 h-px bg-slate-100 dark:bg-emerald-900" />

            {/* Direct messages */}
            <Link
              to="/messages"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/60"
            >
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
                <MessageCircle size={17} />
                {unread > 0 && (
                  <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-fluid-2xs font-bold text-white">
                    {unread > 9 ? "۹+" : unread.toLocaleString("fa-IR")}
                  </span>
                )}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold text-slate-700 dark:text-emerald-50">{t("nav.messages")}</span>
                <span className="block text-fluid-2xs text-slate-400 dark:text-emerald-300/70">{t("direct.title")}</span>
              </span>
            </Link>

            <div className="mx-4 h-px bg-slate-100 dark:bg-emerald-900" />

            {/* Account */}
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-extrabold text-white">
                    {(fullName || "؟").charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800 dark:text-white">{fullName}</span>
                    <span className="block truncate text-fluid-2xs text-slate-400 dark:text-emerald-300/70">{user?.email || user?.username}</span>
                  </span>
                </div>
                {items.map(({ icon: Icon, label, desc, href }) => (
                  <Link
                    key={href}
                    to={href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/60"
                  >
                    <Icon size={16} className="text-emerald-600 dark:text-lime-300" />
                    <span className="flex-1">
                      <span className="block text-sm font-bold text-slate-700 dark:text-emerald-50">{label}</span>
                      <span className="block text-fluid-2xs text-slate-400 dark:text-emerald-300/70">{desc}</span>
                    </span>
                  </Link>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  onClick={signOut}
                  className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-start text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:border-emerald-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                >
                  <LogOut size={16} />
                  {t("nav.logout")}
                </button>
              </>
            ) : (
              <Link
                to="/login"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-lime-300 dark:hover:bg-emerald-900/60"
              >
                <LogIn size={16} />
                {t("nav.login")}
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ========================================
// Header Props
// ========================================
interface HeaderProps {
  cartOpen: boolean;
  onCartOpenChange: (open: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  isDark: boolean;
  onToggleDark: () => void;
  wishlistCount?: number;
  onOpenWishlist?: () => void;
}

// ========================================
// 🎯 Header Component
// ========================================
export default function Header({
  cartOpen,
  onCartOpenChange,
  mobileOpen,
  onMobileOpenChange,
  isDark,
  onToggleDark,
  wishlistCount = 0,
  onOpenWishlist,
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const prevCountRef = useRef<number>(0);
  const { t } = useTranslation();

  const { scrollY } = useScroll();
  const cartCount = useCartStore((state) => state.cart?.total_items || 0);

  // ✨ نوار پیشرفت اسکرول
  const { scrollYProgress } = useScroll();
  const progressScaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  // ========================================
  // ✅ هدر همیشه در دسترس است و هرگز مخفی نمی‌شود —
  //    سرچ‌باکس در همه حالت‌ها (حتی حین اسکرول) بالا می‌ماند.
  //    فقط فاصله‌های داخلی هنگام اسکرول جمع می‌شوند.
  // ========================================
  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 60);
  });

  // ========================================
  // ✅ Bump فقط هنگام «افزایش» تعداد (نه حذف آیتم)
  // ========================================
  useEffect(() => {
    if (cartCount > prevCountRef.current) {
      setBump(true);
      const timeout = setTimeout(() => setBump(false), 550);
      prevCountRef.current = cartCount;
      return () => clearTimeout(timeout);
    }
    prevCountRef.current = cartCount;
  }, [cartCount]);

  const openCart = () => onCartOpenChange(true);

  return (
    <>
      <header className="sticky top-0 z-50">
        <TopBar isDark={isDark} onToggleDark={onToggleDark} />

        <div
          className={`relative border-b border-emerald-100/70 bg-white/90 backdrop-blur-xl transition-shadow duration-300 dark:border-emerald-900/50 dark:bg-[#052e22]/90 ${
            scrolled ? "shadow-lg shadow-emerald-900/8" : ""
          }`}
        >
          {/* Background Glow */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              animate={
                prefersReducedMotion
                  ? undefined
                  : { x: [0, 20, 0], y: [0, -10, 0], opacity: [0.15, 0.3, 0.15] }
              }
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -start-10 -top-16 h-40 w-40 rounded-full bg-emerald-200/25 blur-3xl dark:bg-emerald-500/10"
            />
          </div>

          {/* ======================================== */}
          {/* Main Row: منو (راست) | لوگو (وسط) | سبد (چپ) */}
          {/* ======================================== */}
          <div
            className={`relative mx-auto flex max-w-7xl items-center gap-2 px-2.5 transition-[padding] duration-300 sm:gap-3 sm:px-4 md:gap-4 lg:gap-6 ${
              scrolled ? "py-2 sm:py-2.5" : "py-2.5 sm:py-3 md:py-4"
            }`}
          >
            {/* ✅ Menu Toggle - آیکون morph بین Menu و X */}
            <motion.button
              onClick={() => onMobileOpenChange(!mobileOpen)}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              transition={SPRING}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-[#0F8A5F] transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 sm:h-10 sm:w-10 lg:hidden"
              aria-label={mobileOpen ? t("header.closeMenu") : t("header.openMenu")}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={mobileOpen ? "close" : "open"}
                  initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.18 }}
                  className="flex"
                >
                  {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            {/* Logo */}
            <div className="flex flex-1 justify-center sm:justify-start">
              <Logo compact={scrolled} />
            </div>

            {/* Search (Desktop) — بیشترین عرض برای فیلد جستجو */}
            <div className="hidden min-w-0 flex-1 md:block">
              <SearchBar />
            </div>

            {/* Desktop Actions: تنها علاقه‌مندی و سبد بیرون می‌مانند؛
                حالت شب، پیام‌ها و حساب کاربری داخل منوی «بیشتر» قرار گرفته‌اند. */}
            <div className="ms-auto hidden items-center gap-1 sm:flex sm:gap-1.5 md:gap-2 lg:gap-3">
              <div className="hidden lg:block">
                <MegaMenu />
              </div>

              {/* Wishlist */}
              <IconButton
                onClick={onOpenWishlist}
                label={t("nav.wishlist")}
                className="group text-slate-500 hover:bg-rose-50 hover:text-rose-500 dark:text-emerald-200 dark:hover:bg-rose-950/40"
              >
                <Heart
                  size={18}
                  className="sm:h-5 sm:w-5 transition-transform duration-200 group-hover:scale-110 group-hover:fill-rose-500/20"
                  aria-hidden="true"
                />
                <AnimatePresence>
                  {wishlistCount > 0 && (
                    <motion.span
                      initial={{ scale: 0, y: -8 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ ...SPRING_SOFT, damping: 15 }}
                      className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-0.5 text-fluid-2xs font-bold text-white shadow-md sm:h-5 sm:min-w-5 sm:text-fluid-2xs"
                    >
                      <AnimatedCount value={wishlistCount} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </IconButton>

              {/* منوی «بیشتر»: حالت شب / پیام‌ها / حساب کاربری */}
              <MoreMenu isDark={isDark} onToggleDark={onToggleDark} />

              {/* Cart - Desktop */}
              <CartButton
                count={cartCount}
                bump={bump}
                isOpen={cartOpen}
                onOpen={openCart}
              />
            </div>

            {/* Cart on compact screens */}
            <div className="flex items-center gap-1 sm:hidden">
              <CartButton
                mobile
                count={cartCount}
                bump={bump}
                isOpen={cartOpen}
                onOpen={openCart}
              />
            </div>
          </div>

          {/* ✅ Mobile Search - همیشه در دسترس، حتی هنگام اسکرول */}
          <div className="border-t border-emerald-50 px-2.5 py-2 dark:border-emerald-900/50 sm:px-4 sm:py-2.5 md:hidden">
            <SearchBar variant="mobile" />
          </div>

          {/* Desktop Navigation */}
          <DesktopNav />

          {/* ✨ نوار پیشرفت اسکرول */}
          <motion.div
            aria-hidden="true"
            style={{ scaleX: progressScaleX, transformOrigin: "right" }}
            className="absolute inset-x-0 bottom-0 h-[2px] bg-brand-gradient-accent"
          />
        </div>
      </header>

      <MobileMenu
        open={mobileOpen}
        onClose={() => onMobileOpenChange(false)}
        dark={isDark}
        onToggleDark={onToggleDark}
        wishlistCount={wishlistCount}
        onOpenWishlist={onOpenWishlist}
      />

      <CartDrawer isOpen={cartOpen} onClose={() => onCartOpenChange(false)} />
    </>
  );
}
