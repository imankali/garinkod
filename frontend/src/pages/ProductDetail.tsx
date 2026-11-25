// frontend/src/pages/ProductDetail.tsx

import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, ChevronLeft, Minus, Package, Plus, ShieldCheck, Truck } from 'lucide-react';

import { productsApi } from '../api/services';
import type { Product } from '@/types/shop';
import { useCartStore } from '../store/cartStore';
import { money, priceOf } from '../lib/price';
import { cn } from '../lib/cn';
import { landingPath } from '../lib/landing';
import Button from '../components/ui/Button';
import { ProseSkeleton } from '../components/ui/Skeleton';
import Price from '../components/ui/Price';
import ProductCard from '../components/shop/ProductCard';
import { useTitle } from '../lib/useTitle';

/**
 * A product page answers, in this order: what is it, what does it cost, is it
 * in stock, what is in the box, and what do people who bought it also buy.
 *
 * The buy block is sticky on desktop so the price and the button stay visible
 * while the specifications scroll — the single most useful behaviour on a long
 * catalogue page, and the one thing a "beautiful" product page usually forgets.
 */
export default function ProductDetail() {
  const { slug = '' } = useParams();
  const addToCart = useCartStore((state) => state.addToCart);
  const openCart = useCartStore((state) => state.openCart);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => (await productsApi.getBySlug(slug)).data,
    staleTime: 5 * 60 * 1000,
  });

  const [activeImage, setActiveImage] = useState(0);
  /**
   * Which packaging is being bought. A product that sells in more than one bag
   * (a ۱ لیتری bottle and a ۵ لیتری canister, priced and stocked separately)
   * must be buyable in either — sending no package always bought the default,
   * which quietly hid the larger one.
   *
   * `null` means "the product's own default", resolved below, so this stays a
   * single number rather than a copy of the package list.
   */
  const [packageId, setPackageId] = useState<number | null>(null);
  useTitle(product?.title);

  const similar = useQuery({
    queryKey: ['product-similar', slug],
    queryFn: async () => (await productsApi.getSimilar(slug)).data,
    staleTime: 10 * 60 * 1000,
    enabled: Boolean(product),
  });

  if (isLoading) {
    return (
      <div className="shell py-8">
        <ProseSkeleton />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="shell py-16">
        <h1 className="text-xl font-extrabold text-ink dark:text-white">این کالا پیدا نشد</h1>
        <p className="mt-2 text-sm text-ink-mute dark:text-white/60">
          ممکن است از کاتالوگ حذف شده باشد. فهرست کالاها را ببینید یا از جستجو استفاده کنید.
        </p>
        <Button to="/products" className="mt-5" variant="secondary">
          بازگشت به فروشگاه
        </Button>
      </div>
    );
  }

  const item: Product = product;
  const packages = (item.packages ?? []).filter((entry) => entry.is_in_stock !== false);
  const chosen = packages.find((entry) => entry.id === packageId) ?? packages.find((entry) => entry.is_default) ?? packages[0];
  /**
   * The chosen bag re-prices the page: price, stock and minimum order all come
   * from it when there is one, and from the product otherwise. Without this the
   * price beside the button described a different bag than the one being added.
   */
  const listPrice = chosen?.price ?? item.price;
  const salePrice = chosen ? chosen.discounted_price : item.discounted_price ?? item.price;
  /**
   * A quote-only product has no package prices to show (`effective_price` is 0
   * on a row that only exists to describe the packaging), so it keeps its own
   * «تماس بگیرید» state instead of being re-priced from that zero.
   */
  const selected = chosen && !item.price_on_request ? chosen : null;
  const priced = selected
    ? {
        ...item,
        price: listPrice,
        discounted_price: salePrice,
        // The package states both numbers, so the percentage is derived rather
        // than read from the product's own field (which describes its default).
        discount_percent: listPrice > 0 ? Math.round((1 - salePrice / listPrice) * 100) : 0,
      }
    : item;
  const { off, quote } = priceOf(priced);
  const available = chosen ? chosen.effective_stock : item.stock;
  const inStock = chosen ? chosen.is_in_stock : item.is_in_stock && item.stock > 0;
  const minimum = chosen?.min_order_quantity ?? item.min_order_quantity ?? 1;
  const gallery = [item.image_url, ...(item.gallery?.map((shot) => shot.url) ?? [])].filter(Boolean);
  /**
   * Safety notes come from the typed detail rows the API returns, not from a
   * free-text `warnings` array — the catalogue stores a pesticide's active
   * ingredient and its pre-harvest interval as real fields, so the page reads
   * those instead of inventing a prose block.
   */
  const safety = [
    item.pesticide_detail?.active_ingredient ? `مادهٔ مؤثر: ${item.pesticide_detail.active_ingredient}` : '',
    item.pesticide_detail?.concentration ? `غلظت: ${item.pesticide_detail.concentration}` : '',
    item.fertilizer_detail?.fertilizer_type ? `نوع کود: ${item.fertilizer_detail.fertilizer_type}` : '',
    item.is_expiring_soon && item.expiry_days_left != null
      ? `این بچ کمتر از ${item.expiry_days_left.toLocaleString('fa-IR')} روز تا انقضا دارد.`
      : '',
  ].filter((note) => Boolean(note));


  async function add() {
    if (busy || !inStock) return;
    setBusy(true);
    try {
      await addToCart(item.id, quantity, chosen?.id ?? null);
      setAdded(true);
      openCart();
      window.setTimeout(() => setAdded(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell py-6">
      <nav aria-label="مسیر" className="mb-4 flex items-center gap-1 text-2xs font-bold text-ink-mute dark:text-white/45">
        <Link to="/products" className="transition-colors hover:text-brand-700">فروشگاه</Link>
        <ChevronLeft size={12} aria-hidden="true" />
        <Link
          to={
            typeof item.category === 'string'
              ? '/products'
              : landingPath({ kind: 'category', slug: item.category.slug })
          }
          className="transition-colors hover:text-brand-700"
        >
          {typeof item.category === 'string' ? item.category : item.category.name}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* Gallery: one large image plus thumbnails, no carousel controls —
            a product usually has two or three photos and a slider hides them. */}
        <div>
          <div className="overflow-hidden rounded-lg border border-line bg-paper dark:border-night-line dark:bg-night-soft">
            <img
              src={gallery[activeImage]}
              alt={item.title}
              width={900}
              height={900}
              className="aspect-square w-full object-cover"
            />
          </div>
          {gallery.length > 1 && (
            <ul className="mt-2 flex gap-2">
              {gallery.map((src, index) => (
                <li key={src}>
                  <button
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`تصویر ${index + 1}`}
                    aria-pressed={index === activeImage}
                    className="h-16 w-16 overflow-hidden rounded-sm border-2 transition-colors duration-150 data-[on=true]:border-brand-700"
                    data-on={index === activeImage}
                  >
                    <img src={src} alt="" width={64} height={64} loading="lazy" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <section className="mt-8" aria-labelledby="spec-title">
            <h2 id="spec-title" className="text-base font-extrabold text-ink dark:text-white">مشخصات</h2>
            <dl className="mt-3 divide-y divide-line border-y border-line text-xs dark:divide-night-line dark:border-night-line">
              {[
                ['برند', item.brand],
                ['کد کالا', item.sku],
                ['بسته‌بندی', item.package_weight],
                ['تاریخ انقضا', item.expiry_date],
              ]
                .filter(([, value]) => Boolean(value))
                .map(([term, value]) => (
                  <div key={term as string} className="flex gap-4 py-2.5">
                    <dt className="w-32 shrink-0 text-ink-mute dark:text-white/45">{term}</dt>
                    <dd className="font-medium text-ink dark:text-white/85">{value}</dd>
                  </div>
                ))}
              {(item.attributes ?? []).map((attribute) => (
                <div key={attribute.label} className="flex gap-4 py-2.5">
                  <dt className="w-32 shrink-0 text-ink-mute dark:text-white/45">{attribute.label}</dt>
                  <dd className="font-medium text-ink dark:text-white/85">{attribute.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {item.description && (
            <section className="mt-8" aria-labelledby="desc-title">
              <h2 id="desc-title" className="text-base font-extrabold text-ink dark:text-white">توضیحات</h2>
              <p className="mt-2 max-w-[70ch] whitespace-pre-line text-sm leading-8 text-ink-soft dark:text-white/70">
                {item.description}
              </p>
            </section>
          )}

          {safety.length > 0 && (
            <section className="mt-6 rounded-md border border-gold-600/30 bg-gold-100/50 p-4 dark:border-gold-700/40 dark:bg-gold-700/15" aria-labelledby="warn-title">
              <h2 id="warn-title" className="flex items-center gap-1.5 text-xs font-extrabold text-gold-700 dark:text-gold-100">
                <AlertTriangle size={15} aria-hidden="true" />
                نکات ایمنی
              </h2>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-2xs leading-6 text-ink-soft dark:text-white/70">
                {safety.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Buy block. Sticky on desktop, first on mobile. */}
        <aside className="order-first lg:order-none lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <h1 className="text-xl font-extrabold leading-8 tracking-[-0.02em] text-ink dark:text-white">{item.title}</h1>

          {typeof item.rating_summary?.average === 'number' && item.rating_summary.reviews_count > 0 && (
            <p className="dateline mt-2 text-2xs text-ink-mute dark:text-white/50">
              <span className="font-bold text-gold-700 dark:text-gold-600">
                {item.rating_summary.average.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}
              </span>{' '}
              از ۵ · {item.rating_summary.reviews_count.toLocaleString('fa-IR')} نظر
            </p>
          )}

          <div className="mt-4 rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
            <Price product={priced} size="lg" />
            {off > 0 && (
              <p className="mt-1 text-2xs font-bold text-brand-700 dark:text-brand-300">
                {off.toLocaleString('fa-IR')}٪ تخفیف نسبت به قیمت پیشین
              </p>
            )}

            <p className="mt-3 flex items-center gap-1.5 text-2xs font-bold">
              {inStock ? (
                <>
                  <Check size={14} aria-hidden="true" className="text-brand-700" />
                  <span className="text-brand-800 dark:text-brand-300">موجود در انبار</span>
                  {available > 0 && available < 10 && (
                    <span className="font-medium text-gold-700 dark:text-gold-600">
                      (تنها {available.toLocaleString('fa-IR')} عدد)
                    </span>
                  )}
                  {minimum > 1 && (
                    <span className="font-medium text-ink-mute dark:text-white/45">
                      · حداقل {minimum.toLocaleString('fa-IR')} عدد
                    </span>
                  )}
                </>
              ) : (
                <span className="text-danger-700">ناموجود — برای اطلاع از موجودی با پشتیبانی تماس بگیرید</span>
              )}
            </p>

            {packages.length > 1 && (
              <fieldset className="mt-4">
                <legend className="text-2xs font-bold text-ink-mute dark:text-white/45">بسته‌بندی</legend>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {packages.map((entry) => {
                    const active = entry.id === chosen?.id;
                    return (
                      <button
                        key={entry.id ?? entry.label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setPackageId(entry.id);
                          setQuantity(entry.min_order_quantity || 1);
                        }}
                        className={cn(
                          'min-h-10 rounded-sm border px-3 text-2xs font-bold transition-colors duration-150',
                          active
                            ? 'border-brand-700 bg-brand-700 text-white'
                            : 'border-line bg-paper text-ink-soft hover:border-brand-300 dark:border-night-line dark:bg-night dark:text-white/70',
                        )}
                      >
                        {entry.label}
                        {entry.effective_price > 0 && (
                          <span className={cn('ms-1.5 font-medium', active ? 'text-white/80' : 'text-ink-mute dark:text-white/50')}>
                            {money(entry.effective_price)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {chosen?.bulk_note && (
                  <p className="mt-1.5 text-2xs text-ink-mute dark:text-white/45">{chosen.bulk_note}</p>
                )}
              </fieldset>
            )}

            {!quote && inStock && (
              <div className="mt-4 flex items-center gap-2">
                <div className="flex items-center rounded-sm border border-line dark:border-night-line">
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.max(minimum, value - 1))}
                    aria-label="کاهش تعداد"
                    className="flex h-11 w-11 items-center justify-center text-ink-soft transition-colors duration-150 hover:bg-brand-50 dark:text-white/70 dark:hover:bg-night"
                  >
                    <Minus size={14} aria-hidden="true" />
                  </button>
                  <span aria-live="polite" className="dateline w-10 text-center text-sm font-extrabold text-ink dark:text-white">
                    {quantity.toLocaleString('fa-IR')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.min(available || 99, value + 1))}
                    aria-label="افزایش تعداد"
                    className="flex h-11 w-11 items-center justify-center text-ink-soft transition-colors duration-150 hover:bg-brand-50 dark:text-white/70 dark:hover:bg-night"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </div>
                <Button size="lg" full loading={busy} disabled={!inStock} onClick={add}>
                  {added ? 'به سبد اضافه شد' : 'افزودن به سبد'}
                </Button>
              </div>
            )}

            {quote && (
              <Button to="/support" size="lg" full className="mt-4" variant="secondary">
                درخواست قیمت
              </Button>
            )}

            {/* The wholesale note explains a quote-only price and a minimum
                order, so it sits with the button — once. It used to appear in
                the specifications as «شرایط نگهداری» and again in the safety
                list, which are both places it does not belong. */}
            {item.bulk_note && (
              <p className="mt-3 rounded-sm bg-brand-50 px-2.5 py-2 text-2xs leading-6 text-ink-soft dark:bg-night dark:text-white/60">
                {item.bulk_note}
              </p>
            )}

            <ul className="mt-4 space-y-2 border-t border-line pt-3 text-2xs text-ink-mute dark:border-night-line dark:text-white/50">
              <li className="flex items-center gap-2">
                <Truck size={14} aria-hidden="true" className="text-brand-700 dark:text-brand-300" />
                ارسال رایگان برای خرید بالای {money(3_000_000)}
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck size={14} aria-hidden="true" className="text-brand-700 dark:text-brand-300" />
                اصالت کالا تضمین‌شده؛ بازگشت تا ۷ روز
              </li>
              <li className="flex items-center gap-2">
                <Package size={14} aria-hidden="true" className="text-brand-700 dark:text-brand-300" />
                {item.package_weight || 'بسته‌بندی کارخانه'}
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {(similar.data ?? []).length > 0 && (
        <section className="mt-12" aria-labelledby="similar-title">
          <h2 id="similar-title" className="text-base font-extrabold text-ink dark:text-white">کالاهای مشابه</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(similar.data ?? []).slice(0, 4).map((item2) => (
              <ProductCard key={item2.id} product={item2} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
