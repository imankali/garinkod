// frontend/src/components/layout/Header.tsx

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Menu, Moon, ShoppingBag, Sun, User, X } from 'lucide-react';

import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { cn } from '../../lib/cn';
import Logo from './Logo';
import SearchField from './SearchField';
import { NAV } from './nav';

/**
 * The header is a surface, not a performance.
 *
 * One row on desktop: mark, search, then account and cart. One row on mobile:
 * menu, mark, cart. A second row carries the primary navigation on wide
 * screens and is scrollable on narrow ones.
 *
 * What is deliberately absent, and why:
 *   no auto-hiding — content that vanishes on scroll-down and returns on
 *     scroll-up costs a reader a re-orientation every time they look back up;
 *   no scroll-progress bar — a page is not a download;
 *   no glow, no shimmer, no bounce on the cart count — the number changing is
 *     the feedback;
 *   no hamburger on desktop, no mega-menu: nine destinations fit in a row.
 *
 * The shadow appears only once something is scrolled under the header, which
 * is the moment it is actually floating over content (craft floor: declare
 * elevation once, and only when it is true).
 */
export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const count = useCartStore((state) => state.cart?.total_items ?? 0);
  const openCart = useCartStore((state) => state.openCart);
  const isAuthed = useAuthStore((state) => state.isAuthenticated);
  const isDark = useThemeStore((state) => state.isDark);
  const toggleTheme = useThemeStore((state) => state.toggle);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A route change closes the mobile sheet; nothing else should.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b bg-cream/92 backdrop-blur-md transition-[border-color,box-shadow] duration-[var(--dur-state)]',
        scrolled
          ? 'border-line shadow-[0_1px_0_rgba(20,35,27,0.04),0_8px_24px_-20px_rgba(20,35,27,0.35)] dark:border-night-line'
          : 'border-transparent',
        'dark:bg-night/92',
      )}
    >
      <div className="shell flex h-[var(--header-h)] items-center gap-3">
        {/* Mobile: the menu is a button, not a drawer full of icons. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="منو"
          aria-expanded={open}
          aria-controls="site-menu"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink transition-colors duration-150 hover:bg-brand-50 lg:hidden dark:text-white dark:hover:bg-night-soft"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <Logo />

        <div className="mx-auto hidden w-full max-w-lg lg:block">
          <SearchField />
        </div>

        <div className="ms-auto flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'حالت روز' : 'حالت شب'}
            className="tap flex h-11 w-11 items-center justify-center rounded-md text-ink-soft transition-colors duration-150 hover:bg-brand-50 hover:text-ink dark:text-white/70 dark:hover:bg-night-soft dark:hover:text-white"
          >
            {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => navigate(isAuthed ? '/account' : '/login')}
            aria-label={isAuthed ? 'حساب من' : 'ورود / ثبت‌نام'}
            className="tap hidden h-11 w-11 items-center justify-center rounded-md text-ink-soft transition-colors duration-150 hover:bg-brand-50 hover:text-ink sm:flex dark:text-white/70 dark:hover:bg-night-soft dark:hover:text-white"
          >
            <User size={18} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={openCart}
            aria-label={count > 0 ? `سبد خرید، ${count} کالا` : 'سبد خرید'}
            className="relative flex h-11 items-center gap-2 rounded-md bg-brand-700 px-3 text-white transition-colors duration-150 hover:bg-brand-800"
          >
            <ShoppingBag size={17} aria-hidden="true" />
            <span className="hidden text-xs font-bold sm:inline">سبد خرید</span>
            {count > 0 && (
              <span className="dateline absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-pill bg-gold-600 px-1 text-[11px] font-extrabold text-white">
                {count > 99 ? '۹۹+' : count.toLocaleString('fa-IR')}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search on phones sits under the row: the field is the widest thing on
          the page and cramming it into the header row shrank the mark and the
          cart to icons. */}
      <div className="shell pb-2.5 lg:hidden">
        <SearchField compact />
      </div>

      {/* Primary navigation. On desktop it is a row of nine words; on mobile
          it scrolls sideways rather than hiding five of them behind "more". */}
      <nav aria-label="ناوبری اصلی" className="hidden border-t border-line/70 lg:block dark:border-night-line">
        <div className="shell flex h-11 items-center gap-1">
          {NAV.map((item) => {
            // `aria-current` is the difference between "a row of links" and
            // "a row of links that says where you are" — the colour alone is
            // not something a screen reader can report.
            const current = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex h-full items-center rounded-sm px-3 text-xs font-bold transition-colors duration-150 hover:bg-brand-50 hover:text-brand-800 dark:hover:bg-night-soft dark:hover:text-white',
                  current
                    ? 'text-brand-800 dark:text-white'
                    : 'text-ink-soft dark:text-white/70',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile sheet: plain links, one column, thumb-reachable close. */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
          />
          <div
            id="site-menu"
            role="dialog"
            aria-modal="true"
            aria-label="منوی سایت"
            className="absolute inset-y-0 end-0 flex w-[min(20rem,86vw)] flex-col gap-1 overflow-y-auto bg-paper p-4 shadow-[var(--shadow-panel)] dark:bg-night"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-extrabold text-ink dark:text-white">منو</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="بستن منو"
                className="flex h-11 w-11 items-center justify-center rounded-md text-ink-soft hover:bg-brand-50 dark:text-white/70 dark:hover:bg-night-soft"
              >
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={location.pathname === item.to ? 'page' : undefined}
                className="flex min-h-11 items-center rounded-md px-3 text-sm font-bold text-ink transition-colors duration-150 hover:bg-brand-50 dark:text-white dark:hover:bg-night-soft"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-line pt-2 dark:border-night-line">
              <Link
                to={isAuthed ? '/account' : '/login'}
                className="flex min-h-11 items-center rounded-md px-3 text-sm font-bold text-brand-700 transition-colors duration-150 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-night-soft"
              >
                {isAuthed ? 'حساب من' : 'ورود / ثبت‌نام'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
