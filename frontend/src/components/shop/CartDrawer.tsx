// frontend/src/components/shop/CartDrawer.tsx

import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';

import { useCartStore } from '../../store/cartStore';
import { money } from '../../lib/price';
import { cn } from '../../lib/cn';
import Button from '../ui/Button';

/**
 * The cart, as a panel that slides in from the reading edge.
 *
 * Purpose (Emil): continuity — the item lands somewhere visible instead of
 * the page silently changing a number in the header. Mechanics: 260ms,
 * translate + opacity, `--ease-drawer` (a curve that starts fast and settles
 * slowly, which is what a panel being thrown in feels like); the scrim fades
 * at 180ms. Exiting is faster (180ms) than entering, as it should be.
 *
 * Accessibility: it is a modal dialog — focus moves in, Escape closes, the
 * page behind is inert to scroll, and focus returns to the cart button on
 * close (the browser does that for free if the button still has focus, so the
 * drawer only has to restore scroll and focus the close button on entry).
 */
export default function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  const close = useCartStore((state) => state.closeCart);
  const cart = useCartStore((state) => state.cart);
  const remove = useCartStore((state) => state.removeFromCart);
  const update = useCartStore((state) => state.updateQuantity);
  const fetchCart = useCartStore((state) => state.fetchCart);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen) void fetchCart();
  }, [isOpen, fetchCart]);

  const items = cart?.items ?? [];
  const total = cart?.total_price ?? 0;
  const count = cart?.total_items ?? 0;

  return (
    <div
      aria-hidden={!isOpen}
      className={cn('fixed inset-0 z-50', isOpen ? 'pointer-events-auto' : 'pointer-events-none')}
    >
      <div
        role="presentation"
        onClick={close}
        className={cn(
          'absolute inset-0 bg-ink/45 transition-opacity duration-[var(--dur-state)] ease-[var(--ease-out)] motion-reduce:transition-none',
          isOpen ? 'opacity-100' : 'opacity-0',
          'dark:bg-black/60',
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="سبد خرید"
        className={cn(
          'absolute inset-y-0 start-0 flex w-[min(26rem,92vw)] flex-col bg-paper shadow-[var(--shadow-panel)]',
          'transition-transform duration-[var(--dur-panel)] ease-[var(--ease-drawer)] motion-reduce:transition-none',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'dark:bg-night',
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3 dark:border-night-line">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink dark:text-white">
            <ShoppingBag size={17} aria-hidden="true" />
            سبد خرید
            {count > 0 && (
              <span className="dateline rounded-sm bg-brand-50 px-1.5 py-0.5 text-2xs font-bold text-brand-800 dark:bg-night-soft dark:text-brand-300">
                {count.toLocaleString('fa-IR')} کالا
              </span>
            )}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="بستن سبد"
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-soft transition-colors duration-150 hover:bg-brand-50 dark:text-white/70 dark:hover:bg-night-soft"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-start gap-3 py-12">
              <ShoppingBag size={22} aria-hidden="true" className="text-ink-mute dark:text-white/40" />
              <p className="text-sm font-bold text-ink dark:text-white">سبد خرید خالی است.</p>
              <p className="text-xs text-ink-mute dark:text-white/55">
                از فروشگاه یا غرفه‌های کشاورزان شروع کنید؛ هر کالا موجودی‌اش پیش از پرداخت بررسی می‌شود.
              </p>
              <Button to="/products" size="sm" onClick={close}>
                رفتن به فروشگاه
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-line dark:divide-night-line">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3 py-3">
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-brand-50 dark:bg-night-soft">
                    {(item.product?.image_url || item.listing?.image_url) && (
                      <img
                        src={item.product?.image_url || item.listing?.image_url || ''}
                        alt=""
                        width={64}
                        height={64}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-bold leading-5 text-ink dark:text-white">{item.title}</p>
                    <p className="dateline mt-1 text-2xs text-ink-mute dark:text-white/50">
                      {money(item.unit_price)}
                      {item.package_label ? ` · ${item.package_label}` : ''}
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center rounded-sm border border-line dark:border-night-line">
                        <button
                          type="button"
                          onClick={() => void update(item.id, item.quantity - 1)}
                          aria-label={`کاهش تعداد ${item.title}`}
                          className="flex h-9 w-9 items-center justify-center text-ink-soft transition-colors duration-150 hover:bg-brand-50 dark:text-white/70 dark:hover:bg-night-soft"
                        >
                          <Minus size={13} aria-hidden="true" />
                        </button>
                        <span className="dateline w-8 text-center text-xs font-bold text-ink dark:text-white">
                          {item.quantity.toLocaleString('fa-IR')}
                        </span>
                        <button
                          type="button"
                          onClick={() => void update(item.id, item.quantity + 1)}
                          aria-label={`افزایش تعداد ${item.title}`}
                          className="flex h-9 w-9 items-center justify-center text-ink-soft transition-colors duration-150 hover:bg-brand-50 dark:text-white/70 dark:hover:bg-night-soft"
                        >
                          <Plus size={13} aria-hidden="true" />
                        </button>
                      </div>

                      <span className="dateline text-xs font-extrabold text-ink dark:text-white">
                        {money(item.total_price)}
                      </span>

                      <button
                        type="button"
                        onClick={() => void remove(item.id)}
                        aria-label={`حذف ${item.title}`}
                        className="flex h-9 w-9 items-center justify-center rounded-sm text-ink-mute transition-colors duration-150 hover:bg-danger-50 hover:text-danger-700 dark:text-white/45 dark:hover:bg-danger-700/15"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>

                    {!item.is_in_stock && (
                      <p className="mt-1 text-2xs font-bold text-danger-700 dark:text-danger-600">
                        موجودی این کالا تمام شده؛ پیش از پرداخت حذفش کنید.
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer className="border-t border-line px-4 py-4 dark:border-night-line">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold text-ink-soft dark:text-white/70">جمع سبد</span>
              <span className="dateline text-lg font-extrabold text-ink dark:text-white">{money(total)}</span>
            </div>
            <p className="mt-1 text-2xs text-ink-mute dark:text-white/50">
              هزینهٔ ارسال و موجودی در مرحلهٔ بعد بررسی می‌شود.
            </p>
            <Button to="/checkout" size="lg" full className="mt-3" onClick={close}>
              ادامهٔ خرید
            </Button>
            <Link
              to="/products"
              onClick={close}
              className="mt-2 flex min-h-11 items-center justify-center text-2xs font-bold text-brand-700 transition-colors hover:text-brand-900 dark:text-brand-300"
            >
              افزودن کالای دیگر
            </Link>
          </footer>
        )}
      </aside>
    </div>
  );
}
