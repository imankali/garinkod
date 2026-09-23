// frontend/src/components/Header.tsx

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import { Heart, Menu, ShoppingCart, X } from "lucide-react";

import TopBar from "./TopBar";
import Logo from "./Logo";
import DesktopNav from "./DesktopNav";
import SearchBar from "./SearchBar";
import MobileMenu from "./MobileMenu";
import { useCartStore } from "../store/cartStore";
import { useTranslation } from "../i18n";

// ========================================
// Constants
// ========================================
/** The header collapses only once the reader is past this offset. */
const COLLAPSE_ABOVE = 140;
/** How long the page must be still before the header comes back at the top. */
const TOP_SETTLE_MS = 160;
/** Settling this close to the top counts as having arrived at the top. */
const NEAR_THE_TOP = 12;

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
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  // Mirrors `headerCollapsed` so the gesture handlers below can read the current
  // value without being re-created on every state change, plus the timer that
  // expands the header once the reader has come to rest at the top.
  const collapsedRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const topHoldRef = useRef<number | null>(null);
  // A downward gesture made while there is nothing to collapse yet — a single
  // PageDown from the top of the page arrives before the offset it produces.
  const pendingCollapseRef = useRef(false);
  // A direction asked for with the keyboard. Those scrolls are animated (the
  // stylesheet sets `scroll-behavior: smooth`), and changing the header's height
  // in the middle of one cancels it — the reader presses PageUp and the page
  // stops moving. So the key is recorded and applied once the page has come to
  // rest, exactly like the rule for the top of the page.
  const keyIntentRef = useRef<"down" | "up" | null>(null);
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
  // ✅ هدر هوشمند — جهت اسکرول:
  //    اسکرول به پایین → فقط ردیف اصلی (لوگو/جستجو/سبد) چسبان می‌ماند و
  //    نوار اعلان، جستجوی موبایل و ناوبری دسکتاپ جمع می‌شوند؛
  //    اولین اسکرول رو به بالا همه برمی‌گردند. بالای صفحه همیشه هدر کامل است.
  //
  //    Collapsing removes three rows (~130px) from a sticky header that sits in
  //    the normal flow, so the document reflows — and Chrome answers a reflow by
  //    moving `scrollTop` to hold the content below visually still. That answer
  //    arrives here as an ordinary scroll event running the *other* way, so a
  //    header that reads its direction from `scrollY` reads its own echo as the
  //    reader changing their mind. It flips back, reflows, is answered again,
  //    and the two of them argue several times a second.
  //
  //    Measured on the home page, four seconds in which nothing was touched:
  //    37 distinct header heights and 35 distinct scroll positions, at every
  //    breakpoint and in both motion modes. `html { overflow-anchor: none }`
  //    took both to 1, which is what named the mechanism — but that is not the
  //    fix. Scroll anchoring is the feature that keeps the page still while
  //    images load above it, and trading it away site-wide to protect a header
  //    is a bad bargain.
  //
  //    Nor is it fixed by ignoring events for a moment after a change (a race
  //    against the browser, decided by a stopwatch) or by comparing the visual
  //    position of the content instead of the offset (correct in principle, but
  //    the browser's compensation and the layout that caused it do not always
  //    land in the same frame — traced at 129–485ms into a scroll, the header
  //    still flipped there). Both leave the outcome to timing.
  //
  //    So the direction is not read from the document at all: it is read from
  //    the reader. A wheel, a touch drag and a page-scrolling key each state
  //    their direction unambiguously, and no amount of reflow can impersonate
  //    one. State therefore changes only when a person acts, which also means no
  //    reflow ever interrupts a scroll that is already in flight — the reason
  //    «بازگشت به بالا» used to stop a hundred pixels short of the top.
  //
  //    The one position rule that stays is the top of the page, where the full
  //    header belongs; it waits for the scrolling to stop before it fires, for
  //    the same reason. Scrolling the page by dragging the scrollbar therefore
  //    leaves the header as it is: the trade for a header that cannot twitch.
  // ========================================
  const expandHeader = useCallback(() => {
    pendingCollapseRef.current = false;
    collapsedRef.current = false;
    setHeaderCollapsed(false);
  }, []);

  /**
   * Apply a direction the reader has just asked for.
   *
   * Upwards is unconditional — the full header is never wrong. Downwards only
   * applies once there is a header worth collapsing into the page, so a gesture
   * made at the very top is remembered and applied by the first scroll event
   * that gets there (a PageDown moves the page in one jump and emits nothing
   * afterwards).
   */
  const requestDirection = useCallback(
    (direction: "down" | "up") => {
      pendingCollapseRef.current = false;
      if (direction === "up") {
        expandHeader();
        return;
      }
      if (scrollY.get() > COLLAPSE_ABOVE) {
        pendingCollapseRef.current = false;
        collapsedRef.current = true;
        setHeaderCollapsed(true);
      } else {
        pendingCollapseRef.current = true;
      }
    },
    [expandHeader, scrollY],
  );

  /**
   * Run once the page has stopped moving: bring the rows back at the top, or
   * carry out a direction asked for with the keyboard.
   */
  const scheduleSettle = useCallback(() => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      const intent = keyIntentRef.current;
      keyIntentRef.current = null;

      if (window.scrollY <= NEAR_THE_TOP) {
        // Park exactly at the top before the rows come back. The reflow that
        // follows has nowhere to push the page from 0, while from eight pixels
        // down the browser answers it by moving the page further down to keep
        // the content still — which is how «بازگشت به بالا» used to stop short
        // of the top with the header only half returned.
        if (window.scrollY !== 0) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        expandHeader();
        // The rows and the top strip arrive over the next few frames, and each
        // of those reflows is answered by the browser moving the page a few
        // pixels to keep the content still. At the top there is no content to
        // keep still, so hold it there until they have finished — unless the
        // reader has started moving again, in which case the gesture handlers
        // cancel this.
        topHoldRef.current = window.setTimeout(() => {
          topHoldRef.current = null;
          if (window.scrollY !== 0 && window.scrollY <= NEAR_THE_TOP) {
            window.scrollTo({ top: 0, left: 0, behavior: "instant" });
          }
        }, TOP_SETTLE_MS * 3);
        return;
      }

      if (intent === "up") expandHeader();
      else if (intent === "down") requestDirection("down");
    }, TOP_SETTLE_MS);
  }, [expandHeader, requestDirection]);

  useEffect(() => {
    /** Ignore keys that belong to a field the reader is typing in. */
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

    const cancelTopHold = () => {
      if (topHoldRef.current !== null) {
        window.clearTimeout(topHoldRef.current);
        topHoldRef.current = null;
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 2) return;
      cancelTopHold();
      requestDirection(event.deltaY > 0 ? "down" : "up");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      cancelTopHold();
      if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === "End") {
        keyIntentRef.current = "down";
      } else if (event.key === "ArrowUp" || event.key === "PageUp" || event.key === "Home") {
        keyIntentRef.current = "up";
      } else if (event.key === " ") {
        keyIntentRef.current = event.shiftKey ? "up" : "down";
      } else {
        return;
      }
      scheduleSettle();
    };

    let lastTouchY = 0;
    const onTouchStart = (event: TouchEvent) => {
      cancelTopHold();
      lastTouchY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? lastTouchY;
      // A finger travelling up the glass scrolls the content down.
      const travelled = lastTouchY - y;
      if (Math.abs(travelled) < 6) return;
      cancelTopHold();
      requestDirection(travelled > 0 ? "down" : "up");
      lastTouchY = y;
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [requestDirection, scheduleSettle]);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 60);

    if (pendingCollapseRef.current && latest > COLLAPSE_ABOVE) {
      pendingCollapseRef.current = false;
      collapsedRef.current = true;
      setHeaderCollapsed(true);
    }

    // At the very top, the full header comes back — once the scrolling has
    // stopped. The offset has to be 0 rather than merely small: bringing the
    // rows back reflows the document, and at an offset of 0 that cannot move
    // anyone (the browser will not scroll above the top), while at an offset of
    // 96 it answers by pushing the page down to keep the content still — which
    // is how «بازگشت به بالا» ended up sitting a hundred pixels short of it.
    if (latest <= NEAR_THE_TOP || keyIntentRef.current !== null) {
      scheduleSettle();
    } else if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  });

  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
      if (topHoldRef.current !== null) window.clearTimeout(topHoldRef.current);
    },
    [],
  );

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
        {/* Second rows collapse on scroll-down and return on the first
            scroll-up — the compact row (logo/search/cart) is the only thing
            that stays pinned. AnimatePresence keeps the exit smooth instead
            of a hard jump, and --header-height self-corrects via the
            ResizeObserver above. */}
        <AnimatePresence initial={false}>
          {!headerCollapsed && (
            <motion.div
              key="aux"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <TopBar isDark={isDark} onToggleDark={onToggleDark} />
            </motion.div>
          )}
        </AnimatePresence>

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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-[#0F8A5F] transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
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

            {/* Logo — never shrinks the search field on desktop.
                On compact screens it steps aside for the search once the header
                is collapsed: there is only room for four things in that row, and
                the search is the one the reader asked to keep. The logo is the
                brand you have already found; the field is how you find anything
                else. It returns, animated, with the rest of the header on the
                first scroll back up. */}
            <div
              className={`flex-1 justify-center sm:justify-start md:flex-none ${
                headerCollapsed ? "hidden lg:flex" : "flex"
              }`}
            >
              <Logo compact={scrolled} />
            </div>

            {/* Search (Desktop) — پهن‌ترین عنصر ردیف هدر.
                z-index بالاتر از بقیه هدر تا نتایج جستجو روی همه چیز بیفتد. */}
            <div className="relative z-40 hidden min-w-0 flex-1 md:block">
              <SearchBar />
            </div>

            {/* Search (Compact) — the same field, in the row that stays pinned.
                The two are never on screen together: this one is `md:hidden`, the
                desktop one is `md:block`, and this one only exists while the
                header is collapsed. */}
            {headerCollapsed && (
              <div className="relative z-40 min-w-0 flex-1 md:hidden">
                <SearchBar variant="compact" />
              </div>
            )}

            {/* Desktop Actions: علاقه‌مندی و سبد خرید؛ بقیهٔ امکانات (حالت شب،
                پیام‌ها، حساب کاربری و…) در منوی اصلی (همه‌ی اندازه‌ها) هستند. */}
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

          {/* ✅ Mobile Search — collapses with the header on scroll-down; while
              collapsed the field above (inside the pinned row) takes its place. */}
          <AnimatePresence initial={false}>
            {!headerCollapsed && (
              <motion.div
                key="mobile-search"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="relative z-40 overflow-hidden border-t border-emerald-50 px-[var(--page-gutter)] dark:border-emerald-900/50 md:hidden"
              >
                <div className="py-2 sm:py-2.5">
                  <SearchBar variant="mobile" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Desktop Navigation — same collapse contract as the rows above. */}
          <AnimatePresence initial={false}>
            {!headerCollapsed && (
              <motion.div
                key="desktop-nav"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <DesktopNav />
              </motion.div>
            )}
          </AnimatePresence>

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
