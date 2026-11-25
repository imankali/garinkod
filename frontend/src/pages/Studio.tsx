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
import { Archive, ImagePlus, Layers, PackagePlus, Send, Store, Trash2 } from 'lucide-react';
import { Link } from 'react-router';

import { agricultureApi, storefrontPostsApi, storefrontsApi } from '../api/services';
import type {
  MarketplaceListing,
  Storefront,
  StorefrontHighlight,
  StorefrontPost,
} from '@/types/storefront';
import { parseApiError } from '../api/errors';
import { cn } from '../lib/cn';
import { money, nums } from '../lib/price';
import { date } from '../lib/date';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { useTitle } from '../lib/useTitle';
import { useAuthStore } from '../store/authStore';
import PageHead from '../components/shop/PageHead';
import { LocationFields } from '../components/shop/LocationFields';
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
        {/* Buyers filter stalls by an exact province name, so this must be the
            server's own value rather than whatever was typed. */}
        <LocationFields
          province={province}
          city={city}
          onChange={({ province: next, city: nextCity }) => {
            setProvince(next);
            setCity(nextCity);
          }}
        />
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

/**
 * The composer for the stall's own feed.
 *
 * `storefrontPostsApi.create`, `mine`, `update` and `remove` were the last four
 * methods without a caller: the storefront page could *render* posts and
 * stories, and the seller had no way to make one. That is half a feature — a
 * farmer could be read and not speak.
 *
 * A post and a story go through the same endpoint and differ in `post_type`,
 * which is also what decides the lifetime on the server (a story expires). The
 * page says that out loud instead of leaving the seller to discover it.
 */
function PostComposer({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<'post' | 'story'>('post');
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<File | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      (
        await storefrontPostsApi.create({
          post_type: kind,
          caption: caption.trim(),
          image,
        })
      ).data,
    onSuccess: () => {
      // Both lists change: the seller's own and the stall page the buyer reads.
      void queryClient.invalidateQueries({ queryKey: ['my-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['storefront'] });
      onDone();
    },
  });

  return (
    <form
      noValidate
      className="mt-3 flex flex-col gap-3 rounded-lg border border-line p-4 dark:border-night-line"
      onSubmit={(event) => {
        event.preventDefault();
        if (!caption.trim() || create.isPending) return;
        create.mutate();
      }}
    >
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="نوع">
        {(
          [
            { value: 'post', label: 'پست' },
            { value: 'story', label: 'استوری' },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={kind === option.value}
            onClick={() => setKind(option.value)}
            className={cn(
              'inline-flex min-h-8 items-center rounded-sm px-2 text-2xs font-bold transition-colors',
              kind === option.value
                ? 'bg-brand-700 text-white'
                : 'border border-line text-ink-soft dark:border-night-line dark:text-white/65',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <TextArea
        label="متن"
        required
        rows={3}
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        hint={
          kind === 'story'
            ? 'استوری پس از مدتی خودش بایگانی می‌شود؛ برای خبر ماندگار، پست بگذارید.'
            : 'از برداشت، بسته‌بندی یا کارگاه خود بنویسید.'
        }
      />

      <label className="flex flex-col gap-1 text-2xs font-bold text-ink-soft dark:text-white/65">
        <span className="flex items-center gap-1">
          <ImagePlus size={13} aria-hidden="true" />
          تصویر (اختیاری)
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setImage(event.target.files?.[0] ?? null)}
          className="text-[11px] font-normal text-ink-mute file:me-2 file:rounded-sm file:border-0 file:bg-brand-50 file:px-2 file:py-1 file:text-2xs file:font-bold file:text-brand-800 dark:text-white/45 dark:file:bg-night dark:file:text-brand-300"
        />
      </label>

      {create.isError && (
        <p role="alert" className="text-2xs font-bold text-danger-700">
          {parseApiError(create.error).message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" loading={create.isPending} disabled={!caption.trim()} icon={Send}>
          انتشار
        </Button>
        <Button type="button" variant="quiet" onClick={onDone}>
          انصراف
        </Button>
      </div>
    </form>
  );
}

/**
 * The story archive, and turning archived stories into highlights.
 *
 * `/marketplace/posts/story_archive/` is the whole reason a highlight can be
 * permanent: a story leaves the 24-hour stage by the clock or by the seller's
 * own delete, and the archive keeps it so it can join a collection later. It
 * had no caller, and neither did `createHighlight`/`updateHighlight`/
 * `deleteHighlight` — so a seller could make a story that vanished in a day and
 * could never make the «برداشت» collection the storefront page has a slot for.
 *
 * Each archived row carries `highlight_ids`: the collections it already belongs
 * to. That is used for the badge, not recomputed here — a client that guessed
 * would offer to add a story twice.
 */
function ArchivePanel({ highlights }: { highlights: StorefrontHighlight[] }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const archive = useQuery({
    queryKey: ['story-archive'],
    queryFn: async () => (await storefrontsApi.storyArchive()).data,
  });

  const rows = archive.data ?? [];

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createHighlight = useMutation({
    mutationFn: async () =>
      (
        await storefrontsApi.createHighlight({
          title: title.trim(),
          // Order matters: the strip shows the first six, in this order.
          post_ids: [...selected],
        })
      ).data,
    onSuccess: () => {
      setTitle('');
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ['story-archive'] });
      void queryClient.invalidateQueries({ queryKey: ['my-highlights'] });
      void queryClient.invalidateQueries({ queryKey: ['storefront'] });
    },
  });

  const removeHighlight = useMutation({
    mutationFn: async (id: number) => storefrontsApi.deleteHighlight(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-highlights'] });
      void queryClient.invalidateQueries({ queryKey: ['storefront'] });
    },
  });

  return (
    <section aria-labelledby="archive-title">
      <h2 id="archive-title" className="flex items-center gap-1.5 text-sm font-extrabold text-ink dark:text-white">
        <Archive size={14} aria-hidden="true" />
        آرشیو استوری‌ها
      </h2>
      <p className="mt-1 text-2xs leading-6 text-ink-mute dark:text-white/45">
        استوری‌ای که از صفحهٔ ۲۴ ساعته خارج شود همین‌جا می‌ماند و می‌تواند به یک مجموعهٔ
        ماندگار اضافه شود.
      </p>

      {highlights.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {highlights.map((highlight) => (
            <li
              key={highlight.id}
              className="flex items-center gap-2 rounded-sm border border-line px-2 py-1 text-2xs dark:border-night-line"
            >
              <Layers size={12} aria-hidden="true" className="text-brand-700 dark:text-brand-300" />
              <span className="font-bold text-ink dark:text-white">{highlight.title}</span>
              <span className="dateline text-ink-mute dark:text-white/40">
                {nums(highlight.items.length)}
              </span>
              <button
                type="button"
                onClick={() => removeHighlight.mutate(highlight.id)}
                disabled={removeHighlight.isPending}
                aria-label={`حذف مجموعهٔ ${highlight.title}`}
                className="text-ink-mute hover:text-danger-700 disabled:opacity-50 dark:text-white/40"
              >
                <Trash2 size={11} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {archive.isLoading ? (
        <Skeleton className="mt-3 h-20" />
      ) : rows.length === 0 ? (
        <p className="mt-3 rounded-lg border border-line p-4 text-2xs leading-6 text-ink-mute dark:border-night-line dark:text-white/50">
          آرشیو خالی است. استوری‌هایی که منتشر می‌کنید پس از انقضا اینجا جمع می‌شوند.
        </p>
      ) : (
        <form
          noValidate
          className="mt-3 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim() || selected.size === 0 || createHighlight.isPending) return;
            createHighlight.mutate();
          }}
        >
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {rows.map((row) => (
              <li key={row.id}>
                <label className="flex cursor-pointer flex-col gap-1">
                  <span className="relative block overflow-hidden rounded-md border border-line dark:border-night-line">
                    {row.image_url ? (
                      <img src={row.image_url} alt="" loading="lazy" className="h-20 w-full object-cover" />
                    ) : (
                      <span className="block h-20 w-full bg-brand-50 dark:bg-night-soft" />
                    )}
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      className="absolute end-1 top-1"
                      aria-label={row.caption || 'استوری'}
                    />
                    {(row.highlight_ids ?? []).length > 0 && (
                      <span className="absolute start-1 top-1 rounded-sm bg-brand-700 px-1 text-[10px] font-bold text-white">
                        در مجموعه
                      </span>
                    )}
                  </span>
                  <span className="truncate text-[11px] text-ink-soft dark:text-white/55">
                    {row.caption || 'بدون متن'}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-end gap-2">
            <TextField
              label="نام مجموعه"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              hint="مثلاً: برداشت، بسته‌بندی"
            />
            <Button
              type="submit"
              loading={createHighlight.isPending}
              disabled={!title.trim() || selected.size === 0}
            >
              ساختن مجموعه
            </Button>
          </div>

          {createHighlight.isError && (
            <p role="alert" className="text-2xs font-bold text-danger-700">
              {parseApiError(createHighlight.error).message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

export default function Studio() {
  useTitle('استودیو غرفه');
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [composing, setComposing] = useState(false);

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

  const myPosts = useQuery({
    queryKey: ['my-posts'],
    queryFn: async () => (await storefrontPostsApi.mine()).data,
    enabled: Boolean(user) && Boolean(stall.data),
  });

  // The owner's view of their own collections. The profile response carries
  // them, so this is the same object the public page renders.
  const myHighlights = useQuery({
    queryKey: ['my-highlights'],
    queryFn: async () => (await storefrontsApi.highlights(stall.data?.slug ?? '')).data,
    enabled: Boolean(stall.data?.slug),
  });

  const removePost = useMutation({
    mutationFn: async (id: number) => storefrontPostsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['storefront'] });
    },
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
          <section aria-labelledby="my-posts-title">
            <div className="flex items-center justify-between">
              <h2 id="my-posts-title" className="text-sm font-extrabold text-ink dark:text-white">
                پست‌ها و استوری‌ها
              </h2>
              <Button variant="secondary" size="sm" icon={ImagePlus} onClick={() => setComposing(true)}>
                پست تازه
              </Button>
            </div>

            {composing && <PostComposer onDone={() => setComposing(false)} />}

            {(myPosts.data ?? []).length === 0 ? (
              <p className="mt-3 rounded-lg border border-line p-4 text-2xs leading-6 text-ink-mute dark:border-night-line dark:text-white/50">
                هنوز چیزی منتشر نکرده‌اید. یک عکس از برداشت یا بسته‌بندی، بیشتر از هر توضیحی
                خریدار می‌آورد.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line dark:divide-night-line">
                {(myPosts.data ?? []).map((post: StorefrontPost) => (
                  <li key={post.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink dark:text-white">
                        {post.post_type_label} · {post.status_label}
                        {post.expires_at && (
                          <span className="text-[11px] font-normal text-ink-mute dark:text-white/40">
                            تا {date(post.expires_at)}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-2xs text-ink-soft dark:text-white/60">
                        {post.caption}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePost.mutate(post.id)}
                      disabled={removePost.isPending}
                      aria-label={`حذف ${post.post_type_label}`}
                      className="inline-flex min-h-8 items-center gap-1 rounded-sm px-1.5 text-[11px] font-bold text-ink-mute hover:text-danger-700 disabled:opacity-50 dark:text-white/40"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                      حذف
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ArchivePanel
            highlights={
              (Array.isArray(myHighlights.data)
                ? myHighlights.data
                : myHighlights.data?.results ?? []) as StorefrontHighlight[]
            }
          />
        </>
      )}
    </div>
  );
}
