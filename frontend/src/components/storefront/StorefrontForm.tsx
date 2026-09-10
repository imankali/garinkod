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
import { Link } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { agricultureApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useAuthStore } from '../../store/authStore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import LocationPicker from '../LocationPicker';
import type { SellerType, Storefront, StorefrontAvailability } from '../../types/storefront';
import { cn } from '../../utils/cn';

/** Persian or Arabic digits folded to ASCII, so a pasted ۰۱۲… still validates. */
function toAsciiDigits(value: string): string {
  let out = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? '';
    const codePoint = char.charCodeAt(0);
    // ۰-۹ (U+06F0) and ۰-۹ Arabic-Indic (U+0660) both start a ten-digit run.
    if (codePoint >= 0x0660 && codePoint <= 0x0669) out += String(codePoint - 0x0660);
    else if (codePoint >= 0x06f0 && codePoint <= 0x06f9) out += String(codePoint - 0x06f0);
    else out += char;
  }
  return out;
}

/** Iranian national code: 10 digits, not all the same, with a valid check digit. */
export function isValidNationalId(raw: string): boolean {
  const code = toAsciiDigits(raw.trim());
  if (!/^\d{10}$/.test(code)) return false;
  // Both of the shapes the registry refuses outright: ten identical digits, and
  // a code whose first six digits are one repeated digit.
  if (/^(\d)\1{9}$/.test(code) || code.slice(0, 6) === code.slice(0, 1).repeat(6)) return false;
  const digits = code.split('').map(Number);
  const control = digits[9] ?? -1;
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += (digits[index] ?? 0) * (10 - index);
  }
  const remainder = sum % 11;
  return remainder < 2 ? control === remainder : control === 11 - remainder;
}

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
  const user = useAuthStore((state) => state.user);
  const [store, setStore] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<StorefrontAvailability | null>(null);
  const [checking, setChecking] = useState(false);

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
  const codeTooShort = store.national_id.trim().length > 0 && store.national_id.trim().length < 10;
  const codeInvalid = store.national_id.trim().length >= 10 && !isValidNationalId(store.national_id);

  const canSubmit = useMemo(() => {
    if (!store.name.trim() || !store.province || !store.city) return false;
    if (!store.owner_first_name.trim() || !store.owner_last_name.trim()) return false;
    if (!isValidNationalId(store.national_id)) return false;
    if (nameStatus && !nameStatus.available) return false;
    if (store.slug && slugStatus && !slugStatus.available) return false;
    return true;
  }, [store, nameStatus, slugStatus]);

  async function createStore(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      toast.error('برای ساخت غرفه ابتدا وارد حساب کاربری شوید.');
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
          <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
            نام
            <input
              required
              value={store.owner_first_name}
              onChange={(event) => setStore({ ...store, owner_first_name: event.target.value })}
              aria-invalid={Boolean(fieldErrors.owner_first_name)}
              className={cn(fieldClass, fieldErrors.owner_first_name && 'border-rose-400')}
            />
          </label>
          <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
            نام خانوادگی
            <input
              required
              value={store.owner_last_name}
              onChange={(event) => setStore({ ...store, owner_last_name: event.target.value })}
              aria-invalid={Boolean(fieldErrors.owner_last_name)}
              className={cn(fieldClass, fieldErrors.owner_last_name && 'border-rose-400')}
            />
          </label>
          <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
            کد ملی
            <input
              required
              inputMode="numeric"
              value={store.national_id}
              onChange={(event) => setStore({ ...store, national_id: event.target.value })}
              placeholder="۱۰ رقم"
              aria-invalid={Boolean(fieldErrors.national_id || codeInvalid)}
              aria-describedby="national-id-status"
              className={cn(
                fieldClass,
                (codeInvalid || fieldErrors.national_id) && 'border-rose-400',
                !codeInvalid && !fieldErrors.national_id && store.national_id && 'border-emerald-500',
              )}
            />
          </label>
        </div>
        <p
          id="national-id-status"
          role={codeInvalid || fieldErrors.national_id ? 'alert' : 'status'}
          className={cn(
            'mt-2 text-fluid-xs font-semibold',
            codeInvalid || codeTooShort || fieldErrors.national_id ? 'text-rose-600' : 'text-slate-400',
          )}
        >
          {fieldErrors.national_id ||
            (codeInvalid
              ? 'کد ملی معتبر نیست؛ رقم کنترلی نمی‌خواند.'
              : codeTooShort
                ? 'کد ملی ۱۰ رقم است.'
                : 'همراه با نام و نام خانوادگی روی حساب شما ذخیره می‌شود.')}
        </p>
      </fieldset>

      <motion.button
        type="submit"
        disabled={creating || !canSubmit}
        whileHover={!reduceMotion && canSubmit && !creating ? { y: -4 } : undefined}
        whileTap={!reduceMotion && canSubmit && !creating ? { scale: 0.97 } : undefined}
        className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 min-h-11 text-sm font-bold text-white disabled:opacity-50"
      >
        {creating ? 'در حال ساخت…' : 'ساخت غرفه'}
      </motion.button>
    </form>
  );
}
