// frontend/src/components/MobileMenu.tsx

import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, Heart, LogIn, LogOut, MessageCircle, Moon, Sun, X } from 'lucide-react';

import { visibleSections } from '../config/navigation';
import { useAuthStore, useUserLevel } from '../store/authStore';
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

/**
 * The full mobile navigation drawer.
 *
 * This is the guarantee that nothing is unreachable on a phone: it lists every
 * section the viewer is permitted to see, plus the account, theme and language
 * controls that live in the desktop header.
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

  const sections = visibleSections({ level, isAuthenticated });

  // Close automatically when the route changes, so a tap always feels final.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
        <div className="fixed inset-0 z-[110] lg:hidden">
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
            className="absolute inset-y-0 end-0 flex w-[min(22rem,90vw)] flex-col bg-white shadow-2xl dark:bg-emerald-950"
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
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-600 text-fluid-sm font-extrabold text-white">
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
                              'flex min-h-11 items-center gap-3 rounded-xl px-2 transition-colors',
                              isActive
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-600 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900',
                            )}
                          >
                            <Icon size={17} aria-hidden="true" className="shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-fluid-sm font-bold">{item.label}</span>
                              {item.description && (
                                <span
                                  className={cn(
                                    'block truncate text-fluid-2xs',
                                    isActive ? 'text-emerald-50' : 'text-slate-400 dark:text-emerald-300',
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

              {/* Direct messages shortcut. */}
              <Link
                to="/messages"
                onClick={onClose}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-slate-600 transition-colors hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900"
              >
                <MessageCircle size={17} aria-hidden="true" className="shrink-0" />
                <span className="flex-1 text-start text-fluid-sm font-bold">{t('nav.messages')}</span>
              </Link>

              {/* Wishlist lives here now that the bottom bar shows "more". */}
              {onOpenWishlist && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenWishlist();
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-slate-600 transition-colors hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900"
                >
                  <Heart size={17} aria-hidden="true" className="shrink-0" />
                  <span className="flex-1 text-start text-fluid-sm font-bold">{t('nav.wishlist')}</span>
                  {wishlistCount > 0 && (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-fluid-2xs font-bold text-white">
                      {wishlistCount.toLocaleString('fa-IR')}
                    </span>
                  )}
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
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-fluid-xs font-bold text-slate-700 dark:bg-emerald-900 dark:text-emerald-100"
                aria-pressed={dark}
              >
                {dark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
                {dark ? t('settings.light') : t('settings.dark')}
              </button>

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    void logout();
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 text-fluid-xs font-bold text-rose-600 dark:border-rose-800 dark:text-rose-300"
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
