// frontend/src/components/layout/BottomNav.tsx

import { Link, useLocation } from 'react-router';
import { Percent, Store, User, Wheat } from 'lucide-react';

import { cn } from '../../lib/cn';

/**
 * The phone's persistent bar: four destinations and nothing else.
 *
 * Five items was the previous shape and it put the cart in the middle, which
 * meant the cart existed twice on a phone (here and in the header) while
 * "حساب" was hidden inside a menu. Four destinations + the header's cart is
 * fewer, larger targets for a thumb, and every one of them is a place the
 * visitor actually goes.
 *
 * The active item is marked with colour and weight only: no pill, no sliding
 * indicator, no bounce.
 */
const ITEMS = [
  { to: '/products', label: 'فروشگاه', icon: Wheat },
  { to: '/storefronts', label: 'بازار', icon: Store },
  { to: '/offers', label: 'تخفیف', icon: Percent },
  { to: '/account', label: 'حساب', icon: User },
] as const;

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="ناوبری پایین"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-night-line dark:bg-night/95"
    >
      <ul className="flex items-stretch">
        {ITEMS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[3.5rem] flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold',
                  'transition-colors duration-150',
                  active
                    ? 'text-brand-800 dark:text-brand-300'
                    : 'text-ink-mute hover:text-ink dark:text-white/55 dark:hover:text-white',
                )}
              >
                <Icon size={19} aria-hidden="true" strokeWidth={active ? 2.3 : 1.9} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
