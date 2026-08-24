// frontend/src/components/MobileBottomNav.tsx

import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';

import { MOBILE_BAR_ITEMS } from '../config/navigation';
import { cn } from '../utils/cn';
import { useTranslation } from '../i18n';

interface MobileBottomNavProps {
  cartCount: number;
  onOpenCart: () => void;
}

/**
 * The mobile bottom bar — exactly five destinations: the four pinned links
 * plus the cart in the middle. The previous sixth "more" entry was removed;
 * the full menu stays reachable from the header's menu button.
 *
 * Every control is at least 44px tall and the bar reserves the iOS home
 * indicator area, so nothing sits under the system gesture strip.
 */
export default function MobileBottomNav({
  cartCount,
  onOpenCart,
}: MobileBottomNavProps) {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-emerald-100 bg-white/95 backdrop-blur-xl dark:border-emerald-800 dark:bg-emerald-950/95 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="منوی اصلی موبایل"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {MOBILE_BAR_ITEMS.slice(0, 2).map((item) => (
          <li key={item.id} className="flex-1">
            <BarLink item={item} pathname={pathname} />
          </li>
        ))}

        {/* Cart sits in the middle: the easiest spot to reach with a thumb. */}
        <li className="flex-1">
          <button
            type="button"
            onClick={onOpenCart}
            className="group flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-emerald-700 transition-colors dark:text-lime-300"
            aria-label={`${t('nav.cart')}${cartCount > 0 ? ` — ${cartCount} کالا` : ' — خالی'}`}
          >
            <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white transition-transform group-active:scale-95">
              <ShoppingCart size={16} aria-hidden="true" />
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -end-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-fluid-2xs font-bold text-white"
                  >
                    {cartCount > 9 ? '۹+' : cartCount.toLocaleString('fa-IR')}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className="text-fluid-2xs font-bold">{t('nav.cart')}</span>
          </button>
        </li>

        {MOBILE_BAR_ITEMS.slice(2, 4).map((item) => (
          <li key={item.id} className="flex-1">
            <BarLink item={item} pathname={pathname} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function BarLink({
  item,
  pathname,
}: {
  item: (typeof MOBILE_BAR_ITEMS)[number];
  pathname: string;
}) {
  const Icon = item.icon;
  const { t } = useTranslation();
  // `/` would otherwise match every route, so the home link is compared exactly.
  const isActive = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);

  const label = (() => {
    const key = `nav.${item.id}`;
    const translated = t(key);
    return translated === key ? item.label : translated;
  })();

  return (
    <NavLink
      to={item.to}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors',
        isActive
          ? 'text-emerald-700 dark:text-lime-300'
          : 'text-slate-500 hover:text-emerald-700 dark:text-emerald-200',
      )}
    >
      <span className="relative">
        <Icon size={19} aria-hidden="true" />
        {isActive && (
          <motion.span
            layoutId="mobile-nav-active"
            className="absolute -bottom-1.5 start-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-600 dark:bg-lime-400"
          />
        )}
      </span>
      <span className="text-fluid-2xs font-bold">{label}</span>
    </NavLink>
  );
}
