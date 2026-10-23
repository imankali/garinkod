// frontend/src/components/DesktopNav.tsx
//
// The complete desktop navigation row.
//
// Before this component existed the desktop header only showed five "primary"
// links while the mobile drawer listed every section the viewer was allowed to
// open — so a desktop visitor could not reach the rewards club, the affiliate
// dashboard, the seller studio or the support tools without typing a URL.
// This row now renders exactly the same set of destinations as MobileMenu:
// the shop links inline, and every other section as a dropdown.

import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

import {
  SHOP_ITEMS,
  visibleItems,
  visibleSections,
  type NavItem,
  type NavSection,
} from '../config/navigation';
import { useAuthStore, useUserLevel } from '../store/authStore';
import { useTranslation } from '../i18n';
import { cn } from '../utils/cn';

const SPRING = { type: 'spring', damping: 28, stiffness: 320, mass: 0.6 } as const;

/** Nav labels come from the dictionaries when available. */
function navLabel(t: (key: string) => string, item: NavItem): string {
  const key = `nav.${item.id}`;
  const translated = t(key);
  return translated === key ? item.label : translated;
}

function isItemActive(pathname: string, to: string): boolean {
  const base = to.split('?')[0]!.split('#')[0]!;
  if (base === '/') return pathname === '/';
  return pathname === base || pathname.startsWith(`${base}/`);
}

export default function DesktopNav() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuthStore();
  const level = useUserLevel();
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Any route change closes an open dropdown, so a click always feels final.
  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  // Clicking away or pressing Escape closes the open dropdown.
  useEffect(() => {
    if (!openMenu) return undefined;
    function handlePointer(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpenMenu(null);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenMenu(null);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openMenu]);

  const shopLinks = visibleItems(SHOP_ITEMS, { level, isAuthenticated });
  // Everything that is not a shop link becomes a grouped dropdown, mirroring
  // the sections of the mobile drawer one for one.
  // The header already has a wishlist button, so the dialog-only entry is
  // dropped from the dropdowns rather than duplicated as a dead link.
  const groups: NavSection[] = visibleSections({ level, isAuthenticated })
    .filter((section) => section.id !== 'shop')
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.action) }));

  return (
    <nav
      ref={navRef}
      className="relative z-30 hidden border-t border-emerald-50 bg-gradient-to-l from-emerald-50/40 via-white to-green-50 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:via-ink-deep dark:to-emerald-950/30 lg:block"
      aria-label="ناوبری اصلی"
    >
      <ul
        className="mx-auto flex max-w-7xl flex-wrap items-center gap-0.5 px-[var(--page-gutter)]"
        onMouseLeave={() => setHovered(null)}
      >
        {shopLinks.map((item) => {
          const isActive = isItemActive(pathname, item.to);
          const showUnderline = hovered === item.to || (!hovered && isActive);

          return (
            <li key={item.id} className="relative">
              <Link
                to={item.to}
                onMouseEnter={() => {
                  setHovered(item.to);
                  setOpenMenu(null);
                }}
                onFocus={() => setHovered(item.to)}
                className={cn(
                  'relative flex min-h-11 items-center px-3 text-fluid-sm font-medium transition-colors duration-200',
                  isActive
                    ? 'text-green-700 dark:text-lime-300'
                    : 'text-slate-600 hover:text-green-700 dark:text-emerald-100 dark:hover:text-lime-300',
                )}
                aria-current={isActive ? 'page' : undefined}
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

        {groups.length > 0 && (
          <li aria-hidden="true" className="mx-1.5 h-5 w-px bg-emerald-200 dark:bg-emerald-800" />
        )}

        {groups.map((section) => (
          <li key={section.id} className="relative">
            <NavGroup
              section={section}
              pathname={pathname}
              open={openMenu === section.id}
              onToggle={() =>
                setOpenMenu((current) => (current === section.id ? null : section.id))
              }
              onHover={() => {
                setHovered(null);
                // Hovering another group while one is open swaps them, which
                // is the behaviour people expect from a menu bar.
                setOpenMenu((current) => (current ? section.id : current));
              }}
              onClose={() => setOpenMenu(null)}
              t={t}
            />
          </li>
        ))}

        <li className="ms-auto hidden items-center gap-1.5 py-1 text-fluid-2xs font-semibold text-green-700 dark:text-lime-300 xl:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          کارشناسان آنلاین: پاسخگویی ۲ ساعته
        </li>
      </ul>
    </nav>
  );
}

function NavGroup({
  section,
  pathname,
  open,
  onToggle,
  onHover,
  onClose,
  t,
}: {
  section: NavSection;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onHover: () => void;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const menuId = useId();
  const hasActive = section.items.some((item) => isItemActive(pathname, item.to));

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={onHover}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        className={cn(
          'flex min-h-11 items-center gap-1 rounded-lg px-3 text-fluid-sm font-medium transition-colors duration-200',
          open || hasActive
            ? 'text-green-700 dark:text-lime-300'
            : 'text-slate-600 hover:text-green-700 dark:text-emerald-100 dark:hover:text-lime-300',
        )}
      >
        {section.title}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn('transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {/* Sections with many destinations (بلاگ و راهنما) open as a two-column
          mega panel: nine stacked rows used to reach 785px — taller than the
          viewport — while the same content in two columns fits comfortably
          and reads like the shop panels users already know. Wide panels are
          fixed centred strips under the header: the group buttons sit at both
          ends of the RTL row, so any absolutely-anchored wide panel overflows
          the viewport on one side or the other. Small sections
          (راهنما و پشتیبانی) share the same strip as icon cards: three items
          in one narrow list looked like a stray column; the same items as
          cards read as a deliberate launcher. */}
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            role="menu"
            aria-label={section.title}
            className={cn(
              'z-50 overflow-hidden overflow-y-auto overscroll-contain rounded-2xl border border-emerald-100 bg-white p-1.5 shadow-2xl shadow-emerald-900/10 dark:border-emerald-800 dark:bg-emerald-950',
              section.items.length >= 3
                ? // Fixed strip centred under the header row — always inside
                  // the viewport, whichever end of the RTL row opened it.
                  'fixed inset-x-0 mx-auto w-[min(40rem,calc(100vw-2rem))] max-h-[70dvh] top-[var(--header-height,76px)]'
                : 'absolute start-0 top-[calc(100%+2px)] w-72 max-h-[70dvh]',
            )}
          >
            <div
              className={cn(
                section.items.length >= 6
                  ? 'grid grid-cols-2 gap-x-1 gap-y-0.5'
                  : section.items.length >= 3
                    ? 'grid grid-cols-3 gap-1'
                    : 'flex flex-col',
              )}
            >
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(pathname, item.to);
                const label = (() => {
                  const key = `nav.${item.id}`;
                  const translated = t(key);
                  return translated === key ? item.label : translated;
                })();
                const card = section.items.length < 6 && section.items.length >= 3;

                if (card) {
                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      role="menuitem"
                      onClick={onClose}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center transition-colors',
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/60',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105',
                          isActive
                            ? 'bg-white/15 text-white'
                            : 'bg-gradient-to-br from-emerald-50 to-lime-50 text-emerald-600 dark:from-emerald-900 dark:to-emerald-950 dark:text-lime-300',
                        )}
                      >
                        <Icon size={22} aria-hidden="true" />
                      </span>
                      <span className="text-fluid-sm font-bold">{label}</span>
                      {item.description && (
                        <span
                          className={cn(
                            'block text-fluid-2xs leading-5',
                            isActive ? 'text-emerald-50' : 'text-slate-500 dark:text-emerald-300/70',
                          )}
                        >
                          {item.description}
                        </span>
                      )}
                    </Link>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    role="menuitem"
                    onClick={onClose}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-start gap-3 rounded-xl px-3 py-2 transition-colors',
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/60',
                    )}
                  >
                    <Icon
                      size={16}
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 shrink-0',
                        isActive ? 'text-white' : 'text-emerald-600 dark:text-lime-300',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-fluid-sm font-bold">{label}</span>
                      {item.description && (
                        <span
                          className={cn(
                            'mt-0.5 block text-fluid-2xs leading-5',
                            isActive ? 'text-emerald-50' : 'text-slate-500 dark:text-emerald-300/70',
                          )}
                        >
                          {item.description}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
