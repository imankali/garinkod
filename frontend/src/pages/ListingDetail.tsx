// frontend/src/pages/ListingDetail.tsx

import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CalendarDays, Check, ImageOff, MapPin, Minus, Package, Plus, Store } from 'lucide-react';

import { agricultureApi } from '../api/services';
import { useCartStore } from '../store/cartStore';
import { nums } from '../lib/price';
import Button from '../components/ui/Button';
import Price from '../components/ui/Price';
import { ProseSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { useTitle } from '../lib/useTitle';

/**
 * One آگهی — a farmer's own listing.
 *
 * A listing is sold by weight and volume, so the page is built around the
 * three numbers a buyer cannot do without: price per unit, how much the seller
 * actually has, and the smallest order they will accept. Everything else (who
 * sells it, where, when it was harvested) is stated as a fact row, not a badge.
 *
 * The quantity stepper starts at the listing's minimum order, because typing 1
 * into a 500-kilo minimum is a wasted interaction.
 */
export default function ListingDetail() {
  const { slug = '' } = useParams();
  const addListingToCart = useCartStore((state) => state.addListingToCart);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['listing', slug],
    queryFn: async () => (await agricultureApi.getListing(slug)).data,
    staleTime: 2 * 60 * 1000,
  });

  useTitle(data?.title);

  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (isLoading) {
    return (
      <div className="shell py-8">
        <ProseSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="shell py-16">
        <EmptyState
          icon={Package}
          title="این آگهی پیدا نشد"
          description="آگهی ممکن است فروخته یا از سوی غرفه‌دار بسته شده باشد."
          action={<Button to="/storefronts" variant="secondary" size="sm">بازار کشاورزان</Button>}
        />
      </div>
    );
  }

  const minimum = Math.max(1, data.minimum_order || 1);
  const available = Number(data.quantity_available) || 0;
  const step = Math.max(1, minimum);

  async function add() {
    setBusy(true);
    try {
      await addListingToCart(data!.id, Math.max(minimum, quantity));
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell py-8">
      <nav aria-label="مسیر" className="mb-3 flex flex-wrap items-center gap-1 text-2xs text-ink-mute dark:text-white/45">
        <Link to="/storefronts" className="transition-colors hover:text-brand-700 dark:hover:text-brand-300">بازار کشاورزان</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/storefront/${data.storefront.slug}`} className="transition-colors hover:text-brand-700 dark:hover:text-brand-300">
          {data.storefront.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink dark:text-white/80">{data.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div>
          <div className="overflow-hidden rounded-lg border border-line bg-paper dark:border-night-line dark:bg-night-soft">
            {failed || !data.image_url ? (
              <span className="flex aspect-[4/3] w-full items-center justify-center bg-brand-50 text-ink-mute dark:bg-night dark:text-white/40">
                <ImageOff size={30} aria-hidden="true" />
              </span>
            ) : (
              <img
                src={data.image_url}
                alt={data.title}
                width={1000}
                height={750}
                onError={() => setFailed(true)}
                className="aspect-[4/3] w-full object-cover"
              />
            )}
          </div>

          {data.description && (
            <section className="mt-6" aria-labelledby="listing-description">
              <h2 id="listing-description" className="text-base font-extrabold text-ink dark:text-white">دربارهٔ این محصول</h2>
              <p className="mt-2 max-w-[70ch] whitespace-pre-line text-sm leading-8 text-ink-soft dark:text-white/70">
                {data.description}
              </p>
            </section>
          )}

          <section className="mt-6" aria-labelledby="listing-facts">
            <h2 id="listing-facts" className="text-base font-extrabold text-ink dark:text-white">شرایط فروش</h2>
            <dl className="mt-3 divide-y divide-line border-y border-line text-xs dark:divide-night-line dark:border-night-line">
              {[
                ['موجودی', `${nums(available)} ${data.unit}`],
                ['کمینهٔ سفارش', `${nums(minimum)} ${data.unit}`],
                ['زمان برداشت', data.harvest_date || '—'],
                ['تاریخ تولید', data.production_date || '—'],
                ['تاریخ انقضا', data.expiry_date || '—'],
                ['دسته', data.category_label || data.crop_name],
              ]
                .filter(([, value]) => Boolean(value) && value !== '—')
                .map(([term, value]) => (
                  <div key={term} className="flex gap-4 py-2.5">
                    <dt className="w-32 shrink-0 text-ink-mute dark:text-white/45">{term}</dt>
                    <dd className="font-medium text-ink dark:text-white/85">{value}</dd>
                  </div>
                ))}
              {(data.attributes ?? []).map((attribute) => (
                <div key={attribute.label} className="flex gap-4 py-2.5">
                  <dt className="w-32 shrink-0 text-ink-mute dark:text-white/45">{attribute.label}</dt>
                  <dd className="font-medium text-ink dark:text-white/85">{attribute.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <h1 className="text-xl font-extrabold leading-8 tracking-[-0.02em] text-ink dark:text-white">{data.title}</h1>

          <div className="mt-3 flex items-center gap-2 text-2xs text-ink-mute dark:text-white/50">
            <MapPin size={13} aria-hidden="true" />
            {[data.storefront.province, data.storefront.city].filter(Boolean).join('، ')}
            <span aria-hidden="true">·</span>
            <span className={data.status === 'active' ? 'text-brand-700 dark:text-brand-300' : 'text-danger-700'}>
              {data.status_label}
            </span>
          </div>

          <div className="mt-4 rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
            <Price product={{ price: data.price, discounted_price: data.discounted_price, discount_percent: data.discount_percent }} size="lg" />
            <p className="mt-1 text-2xs text-ink-mute dark:text-white/45">برای هر {data.unit}</p>

            {data.discount_percent > 0 && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-sm bg-brand-50 px-2 py-1 text-2xs font-bold text-brand-800 dark:bg-night dark:text-brand-300">
                <Check size={12} aria-hidden="true" />
                {data.discount_percent.toLocaleString('fa-IR')}٪ زیر قیمت غرفه‌دار
              </p>
            )}

            <div className="mt-4 flex items-center justify-between rounded-sm border border-line px-1 dark:border-night-line">
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(minimum, value - step))}
                aria-label={`کاهش ${step} ${data.unit}`}
                className="flex h-11 w-11 items-center justify-center text-ink-soft transition-colors duration-150 hover:bg-brand-50 dark:text-white/70 dark:hover:bg-night"
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <span aria-live="polite" className="dateline text-sm font-extrabold text-ink dark:text-white">
                {nums(Math.max(minimum, quantity))} {data.unit}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.min(available, value + step))}
                disabled={available > 0 && quantity + step > available}
                aria-label={`افزایش ${step} ${data.unit}`}
                className="flex h-11 w-11 items-center justify-center text-ink-soft transition-colors duration-150 hover:bg-brand-50 disabled:opacity-40 dark:text-white/70 dark:hover:bg-night"
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>

            <Button
              size="lg"
              full
              className="mt-3"
              loading={busy}
              disabled={!data.is_purchasable || available < minimum}
              onClick={add}
            >
              {added ? 'به سبد اضافه شد' : 'افزودن به سبد'}
            </Button>
            {!data.is_purchasable && (
              <p className="mt-2 text-2xs font-bold text-danger-700">این آگهی در حال حاضر قابل خرید نیست.</p>
            )}

            <Button to={`/storefront/${data.storefront.slug}`} variant="secondary" size="md" full className="mt-2" icon={Store}>
              صفحهٔ غرفه و گفتگو
            </Button>

            <p className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-2xs leading-6 text-ink-mute dark:border-night-line dark:text-white/50">
              <CalendarDays size={13} aria-hidden="true" className="mt-1 shrink-0 text-brand-700 dark:text-brand-300" />
              زمان برداشت و هزینهٔ ارسال بار عمده را با غرفه‌دار نهایی کنید؛ موجودی پیش از پرداخت تأیید می‌شود.
            </p>
          </div>

          <Link
            to={`/storefront/${data.storefront.slug}`}
            className="mt-3 flex items-center gap-2.5 rounded-lg border border-line bg-paper p-3 transition-colors duration-[var(--dur-state)] hover:border-brand-300 dark:border-night-line dark:bg-night-soft dark:hover:border-brand-700"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-2xs font-extrabold text-brand-800 dark:bg-night dark:text-brand-300">
              {data.storefront.avatar_url ? (
                <img src={data.storefront.avatar_url} alt="" width={40} height={40} className="h-full w-full object-cover" />
              ) : (
                data.storefront.name.slice(0, 2)
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-xs font-extrabold text-ink dark:text-white">
                {data.storefront.name}
                {data.storefront.is_verified && <BadgeCheck size={13} aria-hidden="true" className="text-brand-700 dark:text-brand-300" />}
              </span>
              <span className="dateline mt-0.5 block text-2xs text-ink-mute dark:text-white/45">
                {data.storefront.seller_type_label} · {nums(data.storefront.sales_count)} فروش
              </span>
            </span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
