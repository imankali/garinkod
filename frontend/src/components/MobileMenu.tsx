// frontend/src/components/MobileMenu.tsx

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, Heart, LogIn, LogOut, MessageCircle, Moon, Sun, X } from 'lucide-react';

import { visibleSections } from '../config/navigation';
import { useAuthStore, useUserLevel } from '../store/authStore';
import { messagesApi } from '../api/services';
import { useTranslation } from '../i18n';
import { cn } from '../utils/cn';
import { acquireScrollLock } from '../utils/scrollLock';
import { IconButton } from './ui/Button';
import Logo from './Logo';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  dark: boolean;
  onToggleDark: () => void;
  wishlistCount?: number;
  onOpenWishlist?: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ========================================
// 🎨 رنگ کاشی آیکون هر آیتم — همان سبک کارت‌های رنگی منوی «بیشتر» قدیمی،
// اما برای تمام آیتم‌های منوی اصلی. فال‌بک: زمردی.
// ========================================
const TILE_STYLES: Record<string, string> = {
  home: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
  products: 'bg-lime-100 text-lime-700 dark:bg-lime-950/60 dark:text-lime-300',
  marketplace: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300',
  storefronts: 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300',
  services: 'bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-300',
  offers: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300',
  profile: 'bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300',
  orders: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300',
  rewards: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-950/60 dark:text-fuchsia-300',
  affiliate: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-300',
  sell: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
  studio: 'bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-300',
  finance: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-950/60 dark:text-yellow-300',
  management: 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300',
  farmers: 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300',
  support: 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300',
  'order-tracking': 'bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300',
  calculator: 'bg-stone-100 text-stone-600 dark:bg-stone-800/80 dark:text-stone-300',
};

const DEFAULT_TILE = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300';

/**
 * The primary navigation drawer — now the main menu for every screen size
 * (phone, tablet and laptop), because it exposes more destinations than the
 * old header menus: every section the viewer is permitted to see, plus the
 * account, theme, messages and wishlist controls.
 *
 * Focus is trapped while open and restored on close, and the panel scrolls
 * independently of the page behind it.
 */
export default function MobileMenu({
  open,
  onClose,
  dark,
  onToggleDark,
  wishlistCount = 0,
  onOpenWishlist,
}: MobileMenuProps) {
  const { pathname } = useLocation();
  const { isAuthenticated, user, account, logout } = useAuthStore();
  const level = useUserLevel();
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const [unread, setUnread] = useState(0);

  const sections = visibleSections({ level, isAuthenticated });

  // Close automatically when the route changes, so a tap always feels final.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Live unread count for the direct-messages shortcut (same behaviour the
  // removed desktop «بیشتر» menu had).
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    const refresh = () =>
      messagesApi
        .conversations()
        .then((response) => {
          if (!cancelled) setUnread(response.data.unread_total || 0);
        })
        .catch(() => undefined);
    void refresh();
    const interval = window.setInterval(() => void refresh(), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement as HTMLElement;
    const releaseLock = acquireScrollLock();

    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, 40);

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
        .filter((element) => element.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      window.clearTimeout(timer);
      releaseLock();
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  const fullName = user
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
    : '';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="منوی اصلی"
            initial={reduceMotion ? { opacity: 0 } : { x: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute inset-y-0 end-0 flex w-[min(24rem,90vw)] flex-col bg-white shadow-2xl dark:bg-emerald-950"
          >
            <header className="flex items-center justify-between gap-2 border-b border-slate-100 p-4 dark:border-emerald-900">
              <Logo />
              <IconButton icon={X} label="بستن منو" onClick={onClose} size="sm" />
            </header>

            {/* Identity block: who am I, and at what level. */}
            <div className="border-b border-slate-100 p-4 dark:border-emerald-900">
              {isAuthenticated ? (
                <Link
                  to="/profile"
                  className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-gradient text-fluid-sm font-extrabold text-white">
                    {account?.avatar_url ? (
                      <img src={account.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      fullName.charAt(0) || '؟'
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fluid-sm font-bold text-slate-800 dark:text-white">
                      {fullName}
                    </span>
                    <span className="block text-fluid-2xs text-emerald-700 dark:text-lime-300">
                      {account?.level_label ?? 'خریدار'}
                    </span>
                  </span>
                  <ChevronLeft size={16} aria-hidden="true" className="shrink-0 text-slate-400 rtl:rotate-0" />
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-fluid-sm font-bold text-white"
                >
                  <LogIn size={16} aria-hidden="true" />
                  ورود یا ثبت‌نام
                </Link>
              )}
            </div>

            <nav aria-label="پیمایش اصلی" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              {sections.map((section) => (
                <div key={section.id} className="mb-5 last:mb-0">
                  <h2 className="mb-1.5 px-2 text-fluid-2xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-emerald-400">
                    {section.title}
                  </h2>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        item.to === '/' ? pathname === '/' : pathname.startsWith(item.to.split('?')[0]!);
                      return (
                        <li key={item.id}>
                          <Link
                            to={item.to}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                              'flex min-h-11 items-center gap-3 rounded-xl p-2 transition-colors',
                              isActive
                                ? 'bg-emerald-600 text-white'
                                : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/60',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                                isActive ? 'bg-white/20 text-white' : (TILE_STYLES[item.id] ?? DEFAULT_TILE),
                              )}
                            >
                              <Icon size={17} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  'block text-fluid-sm font-bold',
                                  isActive ? 'text-white' : 'text-slate-700 dark:text-emerald-50',
                                )}
                              >
                                {item.label}
                              </span>
                              {item.description && (
                                <span
                                  className={cn(
                                    'block truncate text-fluid-2xs',
                                    isActive ? 'text-emerald-50' : 'text-slate-400 dark:text-emerald-300/70',
                                  )}
                                >
                                  {item.description}
                                </span>
                              )}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              {/* Direct messages shortcut — with the live unread badge. */}
              <Link
                to="/messages"
                onClick={onClose}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/60"
              >
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300">
                  <MessageCircle size={17} aria-hidden="true" />
                  {unread > 0 && (
                    <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-fluid-2xs font-bold text-white">
                      {unread > 9 ? '۹+' : unread.toLocaleString('fa-IR')}
                    </span>
                  )}
                </span>
                <span className="flex-1 text-start">
                  <span className="block text-fluid-sm font-bold text-slate-700 dark:text-emerald-50">
                    {t('nav.messages')}
                  </span>
                  <span className="block text-fluid-2xs text-slate-400 dark:text-emerald-300/70">
                    {t('direct.title')}
                  </span>
                </span>
              </Link>

              {/* Wishlist — same tile style, rose accent. */}
              {onOpenWishlist && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenWishlist();
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/60"
                >
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
                    <Heart size={17} aria-hidden="true" />
                    {wishlistCount > 0 && (
                      <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-fluid-2xs font-bold text-white">
                        {wishlistCount > 9 ? '۹+' : wishlistCount.toLocaleString('fa-IR')}
                      </span>
                    )}
                  </span>
                  <span className="flex-1 text-start">
                    <span className="block text-fluid-sm font-bold text-slate-700 dark:text-emerald-50">
                      {t('nav.wishlist')}
                    </span>
                  </span>
                </button>
              )}
            </nav>

            {/* Preferences and sign-out pinned to the bottom. */}
            <footer
              className="space-y-2 border-t border-slate-100 p-4 dark:border-emerald-900"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
            >
              <button
                type="button"
                onClick={onToggleDark}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 text-start transition-colors hover:bg-emerald-100 dark:bg-emerald-900/60 dark:hover:bg-emerald-900"
                aria-pressed={dark}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
                  {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
                </span>
                <span className="flex-1 text-fluid-sm font-bold text-slate-700 dark:text-emerald-100">
                  {dark ? t('settings.light') : t('settings.dark')}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative h-5 w-9 rounded-full transition-colors',
                    dark ? 'bg-emerald-600' : 'bg-slate-300',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
                      dark ? 'start-[18px]' : 'start-0.5',
                    )}
                  />
                </span>
              </button>

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    void logout();
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 text-fluid-xs font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                >
                  <LogOut size={15} aria-hidden="true" />
                  خروج از حساب
                </button>
              )}
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
