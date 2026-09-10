// frontend/src/components/storefront/ListingComposer.tsx
//
// Publish or edit an آگهی from inside the owner's own غرفه page.
//
// This used to live on the account screen (حساب من ← غرفه و فروش) as a
// create-only form: once an آگهی existed there was no way to correct a typo or
// take a sold-out crop down. It now sits where the آگهی actually appears, and
// covers the whole lifecycle.

import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Plus, Save, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { agricultureApi, categoriesApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useTranslation } from '../../i18n';
import type { Category } from '@/types/shop';
import type { MarketplaceListing } from '@/types/storefront';

interface ListingDraft {
  title: string;
  crop_name: string;
  description: string;
  price: string;
  unit: string;
  quantity_available: string;
  min_order_quantity: string;
  /** Slugs, because that is how the API accepts them and how filters match. */
  category: string;
  subcategory: string;
  brand: string;
  package_size: string;
  harvest_date: string;
  discount_percent: string;
  is_stock: boolean;
}

const EMPTY: ListingDraft = {
  title: '',
  crop_name: '',
  description: '',
  price: '',
  unit: 'کیلوگرم',
  quantity_available: '',
  min_order_quantity: '1',
  category: '',
  subcategory: '',
  brand: '',
  package_size: '',
  harvest_date: '',
  discount_percent: '',
  is_stock: false,
};

function draftFrom(listing: MarketplaceListing): ListingDraft {
  return {
    title: listing.title,
    crop_name: listing.crop_name,
    description: listing.description,
    price: String(listing.price),
    unit: listing.unit,
    quantity_available: String(listing.quantity_available),
    min_order_quantity: String(listing.min_order_quantity),
    category: listing.category ?? '',
    subcategory: listing.subcategory ?? '',
    brand: listing.brand ?? '',
    package_size: listing.package_size ?? '',
    harvest_date: listing.harvest_date ? listing.harvest_date.slice(0, 10) : '',
    discount_percent: listing.discount_percent ? String(listing.discount_percent) : '',
    is_stock: Boolean(listing.is_stock),
  };
}

export default function ListingComposer({
  listing,
  open,
  onClose,
  onSaved,
}: {
  /** Omit to create a new آگهی; pass one to edit it. */
  listing?: MarketplaceListing | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const reduceMotion = useReducedMotion();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ListingDraft>(EMPTY);
  const [saving, setSaving] = useState(false);
  /**
   * The departments a seller can file under, with their sub-departments.
   *
   * Loaded lazily the first time the composer opens: the غرفه page itself should
   * not pay for a taxonomy request nobody may use.
   */
  const [departments, setDepartments] = useState<Category[]>([]);

  useEffect(() => {
    if (!open || departments.length > 0) return;
    categoriesApi
      .getAll()
      .then((response) => setDepartments(response.data.results || []))
      .catch(() => setDepartments([]));
  }, [open, departments.length]);

  // Re-seed whenever the dialog opens, so editing one آگهی then another does
  // not carry the first one's values over.
  useEffect(() => {
    if (open) setDraft(listing ? draftFrom(listing) : EMPTY);
  }, [open, listing]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.price) return;
    setSaving(true);
    const payload = {
      title: draft.title.trim(),
      crop_name: draft.crop_name.trim(),
      description: draft.description.trim(),
      price: Number(draft.price),
      unit: draft.unit.trim(),
      quantity_available: draft.quantity_available,
      min_order_quantity: draft.min_order_quantity,
      // Filed under the same taxonomy the warehouse uses, so the آگهی can be
      // found by the department and sub-department filters. Left empty on
      // purpose when nothing is chosen: the server then classifies the text.
      category: draft.category || null,
      subcategory: draft.subcategory || null,
      brand: draft.brand.trim(),
      package_size: draft.package_size.trim(),
      harvest_date: draft.harvest_date || null,
      discount_percent: draft.discount_percent ? Number(draft.discount_percent) : 0,
      is_stock: draft.is_stock,
    } as Partial<MarketplaceListing>;
    try {
      if (listing) {
        await agricultureApi.updateListing(listing.slug, payload);
        toast.success('آگهی به‌روزرسانی شد و دوباره برای بررسی ارسال می‌شود.');
      } else {
        await agricultureApi.createListing(payload);
        toast.success(t('account.listingCreated'));
      }
      onClose();
      await onSaved();
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-emerald-950/40 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={listing ? 'ویرایش آگهی' : t('account.createListing')}
        >
          <motion.form
            initial={reduceMotion ? false : { y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: 40, opacity: 0 }}
            onSubmit={submit}
            className="max-h-[90dvh] w-full [&_button]:min-h-11 [&_button]:min-w-11 [&_input]:min-h-11 [&_input]:min-w-11 max-w-lg overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl dark:border-emerald-800 dark:bg-emerald-950 sm:p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">
                {listing ? 'ویرایش آگهی' : t('account.createListing')}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-emerald-900"
                aria-label={t('common.close')}
              >
                <X size={17} />
              </button>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-emerald-200">
              هر آگهی ابتدا برای بررسی کیفیت و اطلاعات بازار ثبت می‌شود.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field
                label="عنوان آگهی"
                value={draft.title}
                onChange={(value) => setDraft({ ...draft, title: value })}
              />
              <Field
                label="نام محصول"
                value={draft.crop_name}
                onChange={(value) => setDraft({ ...draft, crop_name: value })}
              />
              <Field
                label="قیمت هر واحد (تومان)"
                type="number"
                value={draft.price}
                onChange={(value) => setDraft({ ...draft, price: value })}
              />
              <Field
                label="واحد"
                value={draft.unit}
                onChange={(value) => setDraft({ ...draft, unit: value })}
              />
              <Field
                label="موجودی"
                type="number"
                value={draft.quantity_available}
                onChange={(value) => setDraft({ ...draft, quantity_available: value })}
              />
              <Field
                label="حداقل سفارش"
                type="number"
                value={draft.min_order_quantity}
                onChange={(value) => setDraft({ ...draft, min_order_quantity: value })}
              />

              {/* Classify it like a product: the same department and
                  sub-department the warehouse uses, so a buyer filtering the
                  marketplace by «کود → فسفره» finds this آگهی too. */}
              <SelectField
                label="دسته‌بندی"
                value={draft.category}
                onChange={(value) => setDraft({ ...draft, category: value, subcategory: '' })}
                options={[{ value: '', label: 'بدون دسته‌بندی (خودکار)' }, ...departments.map((item) => ({ value: item.slug, label: item.name }))]}
              />
              <SelectField
                label="زیردسته"
                disabled={!draft.category}
                value={draft.subcategory}
                onChange={(value) => setDraft({ ...draft, subcategory: value })}
                options={[
                  { value: '', label: draft.category ? 'انتخاب کنید (اختیاری)' : 'ابتدا دسته‌بندی' },
                  ...(departments.find((item) => item.slug === draft.category)?.subcategories || []).map((item) => ({
                    value: item.slug,
                    label: item.name,
                  })),
                ]}
              />
              <Field
                required={false}
                label="برند (اختیاری)"
                value={draft.brand}
                onChange={(value) => setDraft({ ...draft, brand: value })}
              />
              <Field
                required={false}
                label="بسته‌بندی (مثلاً ۲۵ کیسه‌ای)"
                value={draft.package_size}
                onChange={(value) => setDraft({ ...draft, package_size: value })}
              />
              <Field
                required={false}
                label="تاریخ برداشت (اختیاری)"
                type="date"
                value={draft.harvest_date}
                onChange={(value) => setDraft({ ...draft, harvest_date: value })}
              />
              <Field
                required={false}
                label="تخفیف (٪)"
                type="number"
                value={draft.discount_percent}
                onChange={(value) => setDraft({ ...draft, discount_percent: value })}
              />
              <label className="flex min-h-11 items-center gap-2 text-xs font-bold text-slate-600 dark:text-emerald-100 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.is_stock}
                  onChange={(event) => setDraft({ ...draft, is_stock: event.target.checked })}
                  className="h-4 w-4 rounded accent-emerald-600"
                />
                این آگهی استوک است (نه برداشت تازه فصل)
              </label>
              <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50 sm:col-span-2">
                توضیحات محصول
                <textarea
                  required
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  className="mt-2 min-h-11 min-w-11 w-full rounded-xl border border-slate-200 bg-white p-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900"
                />
              </label>
            </div>

            <motion.button
              type="submit"
              whileHover={!reduceMotion && !saving ? { y: -4 } : undefined}
              whileTap={!reduceMotion && !saving ? { scale: 0.97 } : undefined}
              disabled={saving}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {listing ? <Save size={16} /> : <Send size={15} />}
              {saving ? t('common.loading') : listing ? t('common.save') : t('account.createListing')}
            </motion.button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The button that opens the composer in create mode. */
export function NewListingButton({ onClick }: { onClick: () => void }) {
  const reduceMotion = useReducedMotion();
  const { t } = useTranslation();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-700"
    >
      <Plus size={14} />
      {t('account.createListing')}
    </motion.button>
  );
}

/**
 * `required` defaults to true because the six core fields are all mandatory;
 * the classification block added for the marketplace is not, and an optional
 * field that blocks submit is how a form gets abandoned.
 */
function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
      {label}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 min-w-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900"
      />
    </label>
  );
}

/** A dropdown with the same shape as Field, so a grid of them lines up. */
function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
