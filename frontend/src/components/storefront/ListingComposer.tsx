// frontend/src/components/storefront/ListingComposer.tsx
//
// Publish or edit an آگهی from inside the owner's own غرفه page.
//
// This used to live on the account screen (حساب من ← غرفه و فروش) as a
// create-only form: once an آگهی existed there was no way to correct a typo or
// take a sold-out crop down. It now sits where the آگهی actually appears, and
// covers the whole lifecycle.

import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Save, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { agricultureApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useTranslation } from '../../i18n';
import type { MarketplaceListing } from '../../types';

interface ListingDraft {
  title: string;
  crop_name: string;
  description: string;
  price: string;
  unit: string;
  quantity_available: string;
  min_order_quantity: string;
}

const EMPTY: ListingDraft = {
  title: '',
  crop_name: '',
  description: '',
  price: '',
  unit: 'کیلوگرم',
  quantity_available: '',
  min_order_quantity: '1',
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
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ListingDraft>(EMPTY);
  const [saving, setSaving] = useState(false);

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-emerald-950/40 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={listing ? 'ویرایش آگهی' : t('account.createListing')}
        >
          <motion.form
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onSubmit={submit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl dark:border-emerald-800 dark:bg-emerald-950 sm:p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">
                {listing ? 'ویرایش آگهی' : t('account.createListing')}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-emerald-900"
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
              <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50 sm:col-span-2">
                توضیحات محصول
                <textarea
                  required
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {listing ? <Save size={16} /> : <Send size={15} />}
              {saving ? t('common.loading') : listing ? t('common.save') : t('account.createListing')}
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The button that opens the composer in create mode. */
export function NewListingButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-700"
    >
      <Plus size={14} />
      {t('account.createListing')}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
      {label}
      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900"
      />
    </label>
  );
}
