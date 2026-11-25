// frontend/src/pages/Studio.tsx
//
// The seller's studio — the screen the levels ladder assumes exists.
//
// `/api/levels/` promises level 3 «غرفه، آگهی و استودیو غرفه». Two thirds of
// that promise had no UI: `agricultureApi.getStorefront` (does this account even
// have a stall?), `createStorefront`, `updateStorefront`,
// `checkStorefrontAvailability`, and the whole listing-writing half —
// `myListings`, `createListing`, `updateListing`, `deleteListing` — were served
// and never called. A seller could read their stall and could not post a single
// آگهی.
//
// The page has two states and shows whichever one the server says is true:
//
//   1. No stall → an application form. The API requires the owner's first and
//      last name and national ID here, because a stall nobody is behind cannot
//      be held responsible for a shipment. Name and slug availability are
//      checked live, as the seller types, against
//      `/marketplace/storefront/availability/` — the endpoint existed for
//      exactly this and nothing used it.
//   2. A stall → their listings with status and, when a moderator rejected one,
//      the reason. Publishing is the server's decision (`status` is read-only
//      on the serializer), so the page never claims an آگهی is live until the
//      response says `published`.

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackagePlus, Store, Trash2 } from 'lucide-react';
import { Link } from 'react-router';

import { agricultureApi } from '../api/services';
import type { MarketplaceListing, Storefront } from '@/types/storefront';
import { parseApiError } from '../api/errors';
import { cn } from '../lib/cn';
import { money, nums } from '../lib/price';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { useTitle } from '../lib/useTitle';
import { useAuthStore } from '../store/authStore';
import PageHead from '../components/shop/PageHead';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SelectField, TextArea, TextField } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';

// Mirrors Storefront.SELLER_TYPE_CHOICES on the backend — not a guess:
// «باغ‌دار» is not one of them, and a type the model does not know would be
// rejected after the whole form had been filled.
const SELLER_TYPES: Array<{ value: Storefront['seller_type']; label: string }> = [
  { value: 'farmer', label: 'کشاورز' },
  { value: 'cooperative', label: 'تعاونی' },
  { value: 'merchant', label: 'تاجر' },
  { value: 'company', label: 'شرکت' },
  { value: 'agro_shop', label: 'نهاده‌های کشاورزی' },
];

/** The status pill. A listing's own status is the only source for this. */
function StatusPill({ status, label }: { status: string; label: string }) {
  const tone =
    status === 'published'
      ? 'bg-brand-50 text-brand-800 dark:bg-night dark:text-brand-300'
      : status === 'rejected'
        ? 'bg-danger-50 text-danger-700 dark:bg-night dark:text-danger-400'
        : 'bg-gold-50 text-gold-700 dark:bg-night dark:text-gold-600';
  return <span className={cn('rounded-sm px-1.5 py-0.5 text-[10px] font-bold', tone)}>{label}</span>;
}

function ApplyForm({ onApplied }: { onApplied: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [sellerType, setSellerType] = useState<Storefront['seller_type']>('farmer');
  const [bio, setBio] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [accepted, setAccepted] = useState(false);

  // Live availability, throttled: checking on every keystroke of a Persian
  // display name would be several requests per second.
  const debouncedName = useDebouncedValue(name, 450);
  const debouncedSlug = useDebouncedValue(slug, 450);

  const availability = useQuery({
    queryKey: ['storefront-availability', debouncedName, debouncedSlug],
    queryFn: async () =>
      (
        await agricultureApi.checkStorefrontAvailability({
          ...(debouncedName ? { name: debouncedName } : {}),
          ...(debouncedSlug ? { slug: debouncedSlug } : {}),
        })
      ).data,
    enabled: Boolean(debouncedName || debouncedSlug),
    staleTime: 30 * 1000,
  });

  const create = useMutation({
    mutationFn: async () =>
      (
        await agricultureApi.createStorefront({
          name: name.trim(),
          slug: slug.trim() || undefined,
          seller_type: sellerType,
          bio: bio.trim(),
          province: province.trim(),
          city: city.trim(),
          owner_first_name: firstName.trim(),
          owner_last_name: lastName.trim(),
          national_id: nationalId.trim(),
          card_number: cardNumber.trim(),
          rules_accepted: accepted,
        })
      ).data,
    onSuccess: onApplied,
  });

  const nameTaken = availability.data?.name && !availability.data.name.available;
  const slugTaken = availability.data?.slug && !availability.data.slug.available;
  const ready =
    name.trim() && firstName.trim() && lastName.trim() && nationalId.trim() && cardNumber.trim() && accepted;

  return (
    <form
      noValidate
      className="flex max-w-3xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready || create.isPending) return;
        create.mutate();
      }}
    >
      <p className="rounded-md border border-line bg-paper p-3 text-2xs leading-6 text-ink-soft dark:border-night-line dark:bg-night-soft dark:text-white/60">
        غرفه‌ای که کسی پشتش نباشد قابل پیگیری نیست؛ به همین دلیل نام، نام خانوادگی و کد ملی مالک در
        همین مرحله گرفته می‌شود. این اطلاعات برای خریدار نمایش داده نمی‌شود.
      </p>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-2xs font-extrabold text-ink dark:text-white">غرفه</legend>
        <TextField
          label="نام غرفه"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          hint={
            nameTaken
              ? 'این نام قبلاً گرفته شده است.'
              : availability.data?.name?.available
                ? 'این نام آزاد است.'
                : undefined
          }
        />
        <TextField
          label="آدرس غرفه (اختیاری)"
          dir="ltr"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          hint={
            slugTaken
              ? availability.data?.slug?.reason || 'این آدرس قابل استفاده نیست.'
              : availability.data?.slug?.suggestion
                ? `پیشنهاد: ${availability.data.slug.suggestion}`
                : 'اگر خالی بماند، از روی نام ساخته می‌شود.'
          }
        />
        <SelectField
          label="نوع فروشنده"
          value={sellerType}
          onChange={(event) => setSellerType(event.target.value as Storefront['seller_type'])}
        >
          {SELLER_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <TextField label="استان" value={province} onChange={(event) => setProvince(event.target.value)} />
        <TextField label="شهر" value={city} onChange={(event) => setCity(event.target.value)} />
      </fieldset>

      <TextArea
        label="معرفی"
        rows={3}
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        hint="چه می‌فروشید، از کجا، و فصل برداشت چه وقت است."
      />

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-2xs font-extrabold text-ink dark:text-white">مالک غرفه</legend>
        <TextField label="نام" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <TextField label="نام خانوادگی" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <TextField
          label="کد ملی"
          required
          dir="ltr"
          inputMode="numeric"
          value={nationalId}
          onChange={(event) => setNationalId(event.target.value)}
        />
        <TextField
          label="شماره کارت برای تسویه"
          required
          dir="ltr"
          inputMode="numeric"
          value={cardNumber}
          onChange={(event) => setCardNumber(event.target.value)}
        />
      </fieldset>

      <label className="flex items-start gap-2 text-2xs leading-6 text-ink-soft dark:text-white/65">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-1"
        />
        <span>
          <Link to="/legal" className="font-bold text-brand-700 hover:underline dark:text-brand-300">
            قوانین غرفه‌داری
          </Link>{' '}
          را خوانده‌ام؛ مسئولیت اصالت، موجودی و ارسال کالای آگهی‌هایم با من است.
        </span>
      </label>

      {create.isError && (
        <p role="alert" className="text-2xs font-bold text-danger-700">
          {parseApiError(create.error).message}
        </p>
      )}

      <Button type="submit" loading={create.isPending} disabled={!ready}>
        ارسال درخواست غرفه
      </Button>
    </form>
  );
}

function ListingForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [crop, setCrop] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('کیلوگرم');
  const [quantity, setQuantity] = useState('');
  const [minOrder, setMinOrder] = useState('');

  const create = useMutation({
    mutationFn: async () =>
      (
        await agricultureApi.createListing({
          title: title.trim(),
          crop_name: crop.trim(),
          description: description.trim(),
          price: Number(price),
          unit: unit.trim() || 'کیلوگرم',
          quantity_available: quantity.trim(),
          min_order_quantity: minOrder.trim() || '1',
        } as Partial<MarketplaceListing>)
      ).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      onDone();
    },
  });

  const ready = title.trim() && crop.trim() && description.trim() && price && quantity;

  return (
    <form
      noValidate
      className="mt-3 flex flex-col gap-3 rounded-lg border border-line p-4 dark:border-night-line"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready || create.isPending) return;
        create.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="عنوان آگهی" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField
          label="محصول"
          required
          value={crop}
          onChange={(e) => setCrop(e.target.value)}
          hint="مثلاً: پسته اکبری، خیار گلخانه‌ای"
        />
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="قیمت هر واحد"
            required
            dir="ltr"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <TextField label="واحد" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="موجودی"
            required
            dir="ltr"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <TextField
            label="حداقل سفارش"
            dir="ltr"
            inputMode="decimal"
            value={minOrder}
            onChange={(e) => setMinOrder(e.target.value)}
            hint="خالی = ۱"
          />
        </div>
      </div>

      <TextArea
        label="توضیح"
        required
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        hint="رقم، بسته‌بندی، فصل برداشت و شرایط ارسال."
      />

      {create.isError && (
        <p role="alert" className="text-2xs font-bold text-danger-700">
          {parseApiError(create.error).message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" loading={create.isPending} disabled={!ready}>
          ثبت آگهی
        </Button>
        <Button type="button" variant="quiet" onClick={onDone}>
          انصراف
        </Button>
      </div>
      <p className="text-[11px] leading-5 text-ink-mute dark:text-white/40">
        آگهی پیش از انتشار بررسی می‌شود؛ تا آن زمان وضعیت «در انتظار تأیید» را همین‌جا می‌بینید.
      </p>
    </form>
  );
}

export default function Studio() {
  useTitle('استودیو غرفه');
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const stall = useQuery({
    queryKey: ['my-storefront'],
    queryFn: async () => (await agricultureApi.getStorefront()).data,
    enabled: Boolean(user),
  });

  const listings = useQuery({
    queryKey: ['my-listings'],
    queryFn: async () => (await agricultureApi.myListings()).data,
    enabled: Boolean(user) && Boolean(stall.data),
  });

  const remove = useMutation({
    mutationFn: async (slug: string) => agricultureApi.deleteListing(slug),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-listings'] }),
  });

  // Checking availability and posting an application is a level-0/1 action, so
  // the "no stall" branch must not be gated on the seller level.
  const hasStall = Boolean(stall.data?.slug);

  const rows = useMemo(() => listings.data ?? [], [listings.data]);

  useEffect(() => {
    if (!hasStall) setAdding(false);
  }, [hasStall]);

  if (!user) {
    return (
      <div className="shell py-16">
        <EmptyState
          icon={Store}
          title="برای استودیو غرفه وارد شوید"
          description="غرفه و آگهی‌ها به حساب شما بسته است."
          action={
            <Button to="/login" size="sm">
              ورود
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <PageHead
        title="استودیو غرفه"
        lead={
          hasStall
            ? 'آگهی‌های شما، وضعیت بررسی هر کدام، و دلیلی که برای رد شدن نوشته شده است.'
            : 'هنوز غرفه‌ای ندارید. با ثبت غرفه، آگهی گذاشتن و دریافت سفارش ممکن می‌شود.'
        }
        actions={
          hasStall ? (
            <Button size="sm" icon={PackagePlus} onClick={() => setAdding(true)}>
              آگهی تازه
            </Button>
          ) : undefined
        }
      />

      {stall.isLoading ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : stall.isError ? (
        <EmptyState icon={Store} title="غرفه خوانده نشد" description="دوباره تلاش کنید." />
      ) : !hasStall ? (
        <ApplyForm
          onApplied={() => {
            void queryClient.invalidateQueries({ queryKey: ['my-storefront'] });
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-extrabold text-ink dark:text-white">
                {stall.data?.name}
                {stall.data?.is_verified && (
                  <span className="rounded-sm bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-800 dark:bg-night dark:text-brand-300">
                    تأییدشده
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-2xs text-ink-mute dark:text-white/50">
                {stall.data?.seller_type_label} · {nums(stall.data?.listing_count ?? rows.length)} آگهی ·{' '}
                {nums(stall.data?.followers_count ?? 0)} دنبال‌کننده
              </p>
              {stall.data?.profile_complete === false && (
                <p className="mt-1 text-[11px] font-bold text-gold-700 dark:text-gold-600">
                  مشخصات غرفه کامل نیست؛ تا تکمیل نشود ممکن است آگهی‌ها منتشر نشوند.
                </p>
              )}
            </div>
            <Button
              to={`/storefront/${stall.data?.slug}`}
              variant="secondary"
              size="sm"
            >
              دیدن غرفه
            </Button>
          </div>

          {adding && <ListingForm onDone={() => setAdding(false)} />}

          <section aria-labelledby="my-listings-title">
            <h2 id="my-listings-title" className="text-sm font-extrabold text-ink dark:text-white">
              آگهی‌های من
            </h2>

            {listings.isLoading ? (
              <div className="mt-3 flex flex-col gap-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : rows.length === 0 ? (
              <p className="mt-3 rounded-lg border border-line p-4 text-2xs leading-6 text-ink-mute dark:border-night-line dark:text-white/50">
                هنوز آگهی ندارید. اولین محصول را ثبت کنید تا در غرفه دیده شود.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line dark:divide-night-line">
                {rows.map((listing) => (
                  <li key={listing.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink dark:text-white">
                        {listing.title}
                        <StatusPill status={listing.status} label={listing.status_label} />
                      </p>
                      <p className="mt-0.5 text-2xs text-ink-mute dark:text-white/50">
                        {listing.crop_name} · {money(listing.price)} / {listing.unit} ·{' '}
                        {nums(Number(listing.quantity_available))} {listing.unit} موجود
                      </p>
                      {listing.rejection_reason && (
                        <p className="mt-1 rounded-sm border-s-2 border-danger-400 bg-danger-50/60 px-2 py-1 text-2xs leading-6 text-danger-700 dark:bg-night-soft dark:text-danger-400">
                          {listing.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/listing/${listing.slug}`}
                        className="text-2xs font-bold text-brand-700 hover:underline dark:text-brand-300"
                      >
                        دیدن
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove.mutate(listing.slug)}
                        disabled={remove.isPending}
                        aria-label={`حذف آگهی ${listing.title}`}
                        className="inline-flex min-h-8 items-center gap-1 rounded-sm px-1.5 text-[11px] font-bold text-ink-mute hover:text-danger-700 disabled:opacity-50 dark:text-white/40"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        حذف
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
