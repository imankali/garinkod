// frontend/src/components/layout/SearchField.tsx

import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, X } from 'lucide-react';

import { productsApi } from '../../api/services';
import type { ProductList } from '@/types/shop';
import { money } from '../../lib/price';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

/**
 * Search: a field, a debounced request, a short list of real products.
 *
 * Deliberately not a command palette. There is no category tree in it, no
 * "recent searches" panel, no keyboard shortcut advertising — a buyer types
 * "کود" and either goes to the results or taps a product they recognise.
 *
 * Behaviour: 300ms debounce (one request per pause, not per keystroke); the
 * list closes on Escape, on blur, and after a navigation; Enter goes to the
 * full results page with the query in the URL so the result is shareable.
 */
export default function SearchField({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(term.trim(), 300);
  const [items, setItems] = useState<ProductList[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (debounced.length < 2) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    productsApi
      .getAll({ search: debounced, page_size: 6 })
      .then((response) => {
        if (!cancelled) setItems(response.data.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const query = term.trim();
    if (!query) return;
    setOpen(false);
    navigate(`/products?search=${encodeURIComponent(query)}`);
  }

  const showList = open && debounced.length >= 2;

  return (
    <div ref={boxRef} className="relative w-full">
      <form role="search" onSubmit={submit} className="relative">
        <label htmlFor={`${listId}-input`} className="sr-only">
          جستجوی کالا
        </label>
        <Search
          size={17}
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-mute dark:text-white/45"
        />
        <input
          id={`${listId}-input`}
          type="search"
          value={term}
          autoComplete="off"
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              (event.target as HTMLInputElement).blur();
            }
          }}
          placeholder={compact ? 'جستجو…' : 'جستجوی کود، سم، بذر یا نام کالا'}
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          className="h-11 w-full rounded-md border border-line bg-cream pe-10 ps-3.5 text-[16px] text-ink placeholder:text-ink-mute/80 transition-colors duration-[var(--dur-state)] hover:border-brand-300 focus:border-brand-700 focus:bg-paper focus:outline-none focus:ring-2 focus:ring-brand-700/15 sm:h-10 sm:text-sm dark:border-night-line dark:bg-night dark:text-white dark:placeholder:text-white/40 dark:focus:border-brand-300"
        />
        {term && (
          <button
            type="button"
            onClick={() => {
              setTerm('');
              setItems([]);
            }}
            aria-label="پاک کردن جستجو"
            className="tap absolute start-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm text-ink-mute transition-colors duration-150 hover:bg-line/60 hover:text-ink dark:text-white/50 dark:hover:bg-night-line dark:hover:text-white"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </form>

      {showList && (
        <div
          id={`${listId}-list`}
          className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-50 overflow-hidden rounded-lg border border-line bg-paper shadow-[var(--shadow-panel)] dark:border-night-line dark:bg-night-soft"
        >
          {loading && items.length === 0 ? (
            <p className="px-4 py-3 text-xs text-ink-mute dark:text-white/50">در حال جستجو…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-3 text-xs text-ink-mute dark:text-white/50">
              چیزی برای «{debounced}» پیدا نشد.
            </p>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setTerm('');
                      navigate(`/product/${item.slug}`);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-start transition-colors duration-150 hover:bg-brand-50 focus-visible:bg-brand-50 dark:hover:bg-night dark:focus-visible:bg-night"
                  >
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-brand-50 dark:bg-night">
                      {item.image_url && (
                        <img src={item.image_url} alt="" width={40} height={40} loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-ink dark:text-white">{item.title}</span>
                      <span className="block truncate text-2xs text-ink-mute dark:text-white/45">{item.category}</span>
                    </span>
                    <span className="dateline shrink-0 text-2xs font-bold text-brand-700 dark:text-brand-300">
                      {money(item.discounted_price ?? item.price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(`/products?search=${encodeURIComponent(debounced)}`);
            }}
            className="w-full border-t border-line px-4 py-2.5 text-start text-2xs font-bold text-brand-700 transition-colors duration-150 hover:bg-brand-50 dark:border-night-line dark:text-brand-300 dark:hover:bg-night"
          >
            دیدن همهٔ نتیجه‌ها برای «{debounced}»
          </button>
        </div>
      )}
    </div>
  );
}
