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
import { Link, useNavigate } from "react-router-dom";

import { useAuthStore } from "../store/authStore";
import TopBar from "./TopBar";
import Logo from "./Logo";
import DesktopNav from "./DesktopNav";
import SearchBar from "./SearchBar";
import MobileMenu from "./MobileMenu";
import { useCartStore } from "../store/cartStore";
import { messagesApi } from "../api/services";
import { useTranslation } from "../i18n";

// ========================================
// Constants
// ========================================
const SPRING = { type: "spring", damping: 28, stiffness: 320, mass: 0.6 } as const;
const SPRING_SOFT = { type: "spring", damping: 22, stiffness: 260 } as const;

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
          ? "h-11 w-11 justify-center px-0"
          : "h-11 px-3 sm:gap-2 md:px-4"
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
      className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200 ${className}`}
      title={label}
      aria-label={label}
    >
      {children}
    </motion.button>
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
              className="flex min-h-12 w-full items-center gap-3 px-4 text-start text-sm font-bold text-slate-700 transition-colors hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/60"
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
                  className="flex min-h-12 w-full items-center gap-3 border-t border-slate-100 px-4 text-start text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:border-emerald-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
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
  const headerRef = useRef<HTMLElement>(null);

  // ========================================
  // ✅ ارتفاع واقعی هدر را در --header-height منتشر می‌کنیم.
  //    هدر sticky است و ارتفاعش با اسکرول و اندازه صفحه تغییر می‌کند؛ بدون این
  //    مقدار، نوارهای sticky داخل صفحه و پرش به لنگرها زیر هدر پنهان می‌شدند.
  // ========================================
  useEffect(() => {
    const element = headerRef.current;
    if (!element) return undefined;

    const publish = () => {
      document.documentElement.style.setProperty(
        "--header-height",
        `${Math.round(element.getBoundingClientRect().height)}px`,
      );
    };
    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(element);
    window.addEventListener("resize", publish);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, []);

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
      <header ref={headerRef} className="sticky top-0 z-50">
        <TopBar isDark={isDark} onToggleDark={onToggleDark} />

        <div
          className={`relative border-b border-emerald-100/70 bg-white/90 backdrop-blur-xl transition-shadow duration-300 dark:border-emerald-900/50 dark:bg-[#052e22]/90 ${
            scrolled ? "shadow-lg shadow-emerald-900/8" : ""
          }`}
        >
          {/* Background Glow — clipped so its blurred box never widens the page. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
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
            className={`relative mx-auto flex max-w-7xl items-center gap-2 px-[var(--page-gutter)] transition-[padding] duration-300 sm:gap-3 md:gap-4 ${
              scrolled ? "py-2 sm:py-2.5" : "py-2.5 sm:py-3 md:py-3.5"
            }`}
          >
            {/* ✅ Menu Toggle - آیکون morph بین Menu و X */}
            <motion.button
              onClick={() => onMobileOpenChange(!mobileOpen)}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              transition={SPRING}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-[#0F8A5F] transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 lg:hidden"
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

            {/* Logo — never shrinks the search field on desktop. */}
            <div className="flex flex-1 justify-center sm:justify-start md:flex-none">
              <Logo compact={scrolled} />
            </div>

            {/* Search (Desktop) — پهن‌ترین عنصر ردیف هدر.
                z-index بالاتر از بقیه هدر تا نتایج جستجو روی همه چیز بیفتد. */}
            <div className="relative z-40 hidden min-w-0 flex-1 md:block">
              <SearchBar />
            </div>

            {/* Desktop Actions: تنها علاقه‌مندی و سبد بیرون می‌مانند؛
                حالت شب، پیام‌ها و حساب کاربری داخل منوی «بیشتر» قرار گرفته‌اند.
                گزینه «دسته‌بندی‌ها» حذف شد — دسته‌بندی‌ها در صفحه محصولات هستند. */}
            <div className="ms-auto hidden shrink-0 items-center gap-1 sm:flex sm:gap-1.5 md:gap-2">
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
          <div className="relative z-40 border-t border-emerald-50 px-[var(--page-gutter)] py-2 dark:border-emerald-900/50 sm:py-2.5 md:hidden">
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

      {/* The global CartDrawer lives in App — rendering it here too would mount
          a second instance whose scroll lock conflicts with the first one. */}
    </>
  );
}
