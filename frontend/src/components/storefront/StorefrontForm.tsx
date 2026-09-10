// frontend/src/components/storefront/StorefrontForm.tsx
//
// ساخت غرفه — the one place a storefront is created.
//
// This form used to live inside the بازار صفحه (Marketplace.tsx) and a second,
// smaller copy sat in حساب من. Two copies of a form is how two copies of the
// rules drift apart, so the merged غرفه‌داران page has one.
//
// What is new is the identity block. A stall that anyone can open under a
// nickname is a stall where a bad delivery is nobody's fault, so a full name and
// a national code are now part of *opening* a storefront: the code is collected
// here, checked here (checksum, not just length) and written onto the owner's
// account by the API — never onto the public page, which only ever sees a mask.
//
// The name/availability checks are advisory while typing; the server's unique
// constraints still decide, which is why a failed submit maps the API's field
// errors back onto these inputs.

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { agricultureApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useAuthStore } from '../../store/authStore';
import { isValidNationalId, nationalIdError } from '../../utils/nationalId';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import LocationPicker from '../LocationPicker';
import type { SellerType, Storefront, StorefrontAvailability } from '../../types/storefront';
import { cn } from '../../utils/cn';

/** Where a half-filled form waits while its author signs in. */
const DRAFT_KEY = 'garinkod:storefront-draft';

const EMPTY = {
  name: '',
  slug: '',
  seller_type: 'farmer' as SellerType,
  bio: '',
  province: '',
  city: '',
  owner_first_name: '',
  owner_last_name: '',
  national_id: '',
};

const fieldClass =
  'mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900';

export default function StorefrontForm({
  onCreated,
  variant = 'card',
}: {
  onCreated: (storefront: Storefront) => void | Promise<void>;
  /** `dialog` is the compact version the غرفه‌داران page opens; `card` is the page version. */
  variant?: 'card' | 'dialog';
}) {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  /**
   * The address that reopens this form after signing in. Building a غرفه is the
   * one thing a visitor can start while signed out — name and address are checked
   * against the registry in public — so sending them to /login and dropping the
   * half-filled form behind them is the failure this avoids.
   */
  const returnTo = variant === 'card' ? '/studio' : '/storefronts?create=1';
  const [store, setStore] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<StorefrontAvailability | null>(null);
  const [checking, setChecking] = useState(false);

  /*
    Signing in is a round trip through another page, and a form that loses the
    name, the city and the national code on the way back is a form people abandon.
    So the draft is parked for the duration — in sessionStorage, which dies with
    the tab, because a national code has no business outliving a browsing session
    in local storage.
  */
  useEffect(() => {
    let restored: Partial<typeof EMPTY> | null = null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        sessionStorage.removeItem(DRAFT_KEY);
        restored = JSON.parse(raw) as Partial<typeof EMPTY>;
      }
    } catch {
      // A draft that cannot be read is simply no draft.
    }
    if (restored) setStore((current) => ({ ...current, ...restored }));
  }, []);

  // The profile already knows this person's name, so the form starts filled and
  // they only correct it. The national code has no source but them.
  useEffect(() => {
    if (!user) return;
    setStore((current) => ({
      ...current,
      owner_first_name: current.owner_first_name || user.first_name || '',
      owner_last_name: current.owner_last_name || user.last_name || '',
    }));
  }, [user]);

  const debouncedName = useDebouncedValue(store.name, 400);
  const debouncedSlug = useDebouncedValue(store.slug, 400);

  useEffect(() => {
    const name = debouncedName.trim();
    const slug = debouncedSlug.trim();
    if (name.length < 3 && !slug) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    agricultureApi
      .checkStorefrontAvailability({ name: name || undefined, slug: slug || undefined })
      .then((response) => {
        if (!cancelled) setAvailability(response.data);
      })
      .catch(() => {
        if (!cancelled) setAvailability(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedName, debouncedSlug]);

  const nameStatus = availability?.name;
  const slugStatus = availability?.slug;
  // Silent while the field is still untouched, worded like the server once it is
  // not: the same problem must not read differently in the browser and in the API.
  const nationalIdIssue = store.national_id.trim() ? nationalIdError(store.national_id) : '';
  const identityIssues = {
    owner_first_name: store.owner_first_name.trim() ? '' : 'نام را وارد کنید.',
    owner_last_name: store.owner_last_name.trim() ? '' : 'نام خانوادگی را وارد کنید.',
    national_id: nationalIdIssue,
  };

  const canSubmit = useMemo(() => {
    if (!store.name.trim() || !store.province || !store.city) return false;
    if (!store.owner_first_name.trim() || !store.owner_last_name.trim()) return false;
    if (!isValidNationalId(store.national_id)) return false;
    if (nameStatus && !nameStatus.available) return false;
    if (store.slug && slugStatus && !slugStatus.available) return false;
    return true;
  }, [store, nameStatus, slugStatus]);

  function signInToContinue() {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    } catch {
      // Storage disabled (private mode) — the form still works, it just will not
      // survive the trip.
    }
    navigate('/login', { state: { from: returnTo } });
  }

  async function createStore(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      // Not an error to shrug at: the visitor is one step from finishing, so the
      // button takes them to the step instead of lecturing them about it.
      signInToContinue();
      return;
    }
    setCreating(true);
    setFieldErrors({});
    try {
      const response = await agricultureApi.createStorefront({
        name: store.name.trim(),
        slug: store.slug.trim() || undefined,
        seller_type: store.seller_type,
        bio: store.bio.trim(),
        province: store.province,
        city: store.city,
        owner_first_name: store.owner_first_name.trim(),
        owner_last_name: store.owner_last_name.trim(),
        national_id: store.national_id.trim(),
      });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // Nothing to clean up where storage is unavailable.
      }
      toast.success('غرفه شما ساخته شد؛ آگهی‌ها پس از بررسی منتشر می‌شوند.');
      await onCreated(response.data);
    } catch (error) {
      const parsed = parseApiError(error);
      setFieldErrors(parsed.fields);
      if (Object.keys(parsed.fields).length === 0 && !parsed.handled) toast.error(parsed.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <form
      onSubmit={createStore}
      className={cn(
        variant === 'card'
          ? 'mt-6 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950'
          : 'space-y-1',
      )}
    >
      {variant === 'card' && (
        <>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">ساخت غرفه فروشنده</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">
            پس از ساخت غرفه، آگهی‌ها در وضعیت بررسی قرار می‌گیرند و فقط پس از تأیید منتشر می‌شوند.{' '}
            <Link to="/legal/marketplace" className="font-bold text-emerald-700 underline dark:text-lime-300">
              قوانین غرفه‌داری
            </Link>
            را پیش از انتشار بخوانید.
          </p>
        </>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="store-name" className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
            نام غرفه <span className="text-rose-500">*</span>
          </label>
          <div className="relative mt-2">
            <input
              id="store-name"
              required
              value={store.name}
              onChange={(event) => setStore({ ...store, name: event.target.value })}
              aria-invalid={Boolean(fieldErrors.name) || nameStatus?.available === false}
              aria-describedby="store-name-status"
              className={cn(
                'w-full rounded-xl border px-3 py-2.5 pe-9 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-900',
                nameStatus?.available === false || fieldErrors.name
                  ? 'border-rose-400'
                  : nameStatus?.available
                    ? 'border-emerald-500'
                    : 'border-slate-200 dark:border-emerald-700',
              )}
            />
            <span className="absolute end-3 top-1/2 -translate-y-1/2">
              {checking ? (
                <Loader2 size={16} className="animate-spin text-slate-400" />
              ) : nameStatus?.available ? (
                <CheckCircle2 size={16} className="text-emerald-500" />
              ) : nameStatus?.available === false ? (
                <XCircle size={16} className="text-rose-500" />
              ) : null}
            </span>
          </div>
          <p
            id="store-name-status"
            role={nameStatus?.available === false || fieldErrors.name ? 'alert' : 'status'}
            className={cn(
              'mt-1 text-fluid-xs font-semibold',
              nameStatus?.available === false || fieldErrors.name
                ? 'text-rose-600'
                : nameStatus?.available
                  ? 'text-emerald-600'
                  : 'text-slate-400',
            )}
          >
            {fieldErrors.name ||
              nameStatus?.reason ||
              (nameStatus?.available ? 'این نام آزاد است ✓' : 'حداقل ۳ کاراکتر بنویسید.')}
          </p>
        </div>

        <div>
          <label htmlFor="store-slug" className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
            آدرس یکتا (اختیاری)
          </label>
          <input
            id="store-slug"
            value={store.slug}
            onChange={(event) => setStore({ ...store, slug: event.target.value })}
            placeholder="در صورت خالی بودن، از روی نام ساخته می‌شود"
            aria-invalid={Boolean(fieldErrors.slug) || slugStatus?.available === false}
            aria-describedby="store-slug-status"
            className={cn(
              'mt-2 w-full rounded-xl border px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-900',
              slugStatus?.available === false || fieldErrors.slug
                ? 'border-rose-400'
                : 'border-slate-200 dark:border-emerald-700',
            )}
          />
          <p id="store-slug-status" className="mt-1 text-fluid-xs font-semibold text-slate-400">
            {fieldErrors.slug ||
              (slugStatus?.available === false
                ? `${slugStatus.reason} پیشنهاد: ${slugStatus.suggestion}`
                : slugStatus?.value
                  ? `آدرس غرفه: /storefronts/${slugStatus.value}`
                  : 'می‌توانید خالی بگذارید.')}
          </p>
        </div>

        <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
          نوع فروشنده
          <select
            value={store.seller_type}
            onChange={(event) => setStore({ ...store, seller_type: event.target.value as SellerType })}
            className={fieldClass}
          >
            <option value="farmer">کشاورز</option>
            <option value="cooperative">تعاونی</option>
            <option value="merchant">تاجر</option>
            <option value="company">شرکت</option>
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2 md:col-span-1">
          <LocationPicker
            idPrefix="store"
            required
            province={store.province}
            city={store.city}
            onProvinceChange={(value) => setStore({ ...store, province: value, city: '' })}
            onCityChange={(value) => setStore({ ...store, city: value })}
            provinceError={fieldErrors.province}
            cityError={fieldErrors.city}
          />
        </div>

        <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50 md:col-span-2">
          معرفی کوتاه (اختیاری)
          <textarea
            value={store.bio}
            onChange={(event) => setStore({ ...store, bio: event.target.value })}
            rows={3}
            className={fieldClass}
          />
        </label>
      </div>

      {/*
        هویت صاحب غرفه. These three inputs are the difference between a
        marketplace and a notice board: the platform can only stand behind a
        seller it can identify, and it can only do that if the seller has said
        who they are. The code is stored on the account, not on the stall.
      */}
      <fieldset className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-800 dark:bg-emerald-900/30">
        <legend className="px-1 text-sm font-extrabold text-slate-800 dark:text-white">
          هویت صاحب غرفه <span className="text-rose-500">*</span>
        </legend>
        <p className="mb-3 text-fluid-xs leading-6 text-slate-500 dark:text-emerald-200">
          این اطلاعات فقط برای احراز هویت و رسیدگی به اختلاف‌هاست و در صفحه عمومی غرفه نمایش داده نمی‌شود.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <IdentityField
            id="store-owner-first-name"
            label="نام"
            value={store.owner_first_name}
            error={fieldErrors.owner_first_name || identityIssues.owner_first_name}
            onChange={(value) => setStore({ ...store, owner_first_name: value })}
          />
          <IdentityField
            id="store-owner-last-name"
            label="نام خانوادگی"
            value={store.owner_last_name}
            error={fieldErrors.owner_last_name || identityIssues.owner_last_name}
            onChange={(value) => setStore({ ...store, owner_last_name: value })}
          />
          <IdentityField
            id="store-national-id"
            label="کد ملی"
            value={store.national_id}
            inputMode="numeric"
            placeholder="۱۰ رقم"
            hint="همراه با نام و نام خانوادگی روی حساب شما ذخیره می‌شود."
            error={fieldErrors.national_id || identityIssues.national_id}
            valid={Boolean(store.national_id.trim()) && !nationalIdIssue}
            onChange={(value) => setStore({ ...store, national_id: value })}
          />
        </div>
      </fieldset>

      {!user && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <span>
            نام غرفه را می‌توانید همین‌جا بررسی کنید؛ برای ثبت نهایی، وارد حساب خود شوید تا غرفه به نام شما ثبت شود.
          </span>
          <button
            type="button"
            onClick={signInToContinue}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-amber-600 px-4 text-xs font-bold text-white transition hover:bg-amber-700"
          >
            ورود یا ثبت‌نام
          </button>
        </div>
      )}

      <motion.button
        type="submit"
        disabled={creating || !canSubmit}
        whileHover={!reduceMotion && canSubmit && !creating ? { y: -4 } : undefined}
        whileTap={!reduceMotion && canSubmit && !creating ? { scale: 0.97 } : undefined}
        className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 min-h-11 text-sm font-bold text-white disabled:opacity-50"
      >
        {creating ? 'در حال ساخت…' : user ? 'ساخت غرفه' : 'ورود و ساخت غرفه'}
      </motion.button>
    </form>
  );
}

/**
 * One identity input, with its own error line.
 *
 * A red border alone is not feedback: the person has to be told what is wrong
 * with the digits they typed, and a screen reader has to be pointed at that text
 * with `aria-describedby` rather than left to guess from `aria-invalid`.
 */
function IdentityField({
  id,
  label,
  value,
  onChange,
  error = '',
  hint = '',
  valid = false,
  inputMode,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  valid?: boolean;
  inputMode?: 'numeric' | 'text';
  placeholder?: string;
}) {
  const message = error || hint;
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-bold text-slate-700 dark:text-emerald-50"
      >
        {label}
      </label>
      <input
        id={id}
        required
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={message ? `${id}-status` : undefined}
        className={cn(
          'w-full rounded-xl border px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-900',
          error
            ? 'border-rose-400'
            : valid
              ? 'border-emerald-500'
              : 'border-slate-200 dark:border-emerald-700',
        )}
      />
      {message && (
        <p
          id={`${id}-status`}
          role={error ? 'alert' : undefined}
          className={cn(
            'mt-1 text-fluid-xs font-semibold',
            error ? 'text-rose-600' : 'text-slate-400',
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
