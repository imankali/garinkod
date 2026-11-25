// frontend/src/components/shop/StorefrontComplaintForm.tsx
//
// A complaint that can actually be filed.
//
// The support page's FAQ said «از صفحهٔ همان غرفه پیام ثبت کنید تا در صف رسیدگی
// قرار بگیرد و شمارهٔ پیگیری بگیرد», and `trustApi.complaint` was wired to
// POST /api/complaints/storefront/ from the first commit — but no screen ever
// called it. The complaint queue had no front door.
//
// The endpoint takes a storefront id and a description and returns the saved
// complaint with its own id and status label. That id is the reference the
// support copy promises, so the confirmation prints it rather than an invented
// order-like code.

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router';

import { storefrontsApi, trustApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import type { Storefront } from '@/types/storefront';
import { useAuthStore } from '../../store/authStore';
import { nums } from '../../lib/price';
import Button from '../ui/Button';
import { SelectField, TextArea, TextField } from '../ui/Field';

export default function StorefrontComplaintForm() {
  // Filing a complaint requires an account: the server ties the row to the
  // complainant (``permissions.IsAuthenticated`` plus a ``complainant`` FK), and
  // a complaint nobody can be identified behind is one staff cannot follow up.
  // A guest therefore gets the reason and a way in, rather than a form that
  // ends in a 401 after they have typed out what went wrong.
  const signedIn = useAuthStore((state) => state.isAuthenticated);
  const [open, setOpen] = useState(false);
  const [storefront, setStorefront] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);

  const stores = useQuery({
    queryKey: ['storefronts-for-complaint'],
    queryFn: async () => (await storefrontsApi.list({ page_size: 100 })).data,
    enabled: open && signedIn,
    staleTime: 10 * 60 * 1000,
  });

  const options: Storefront[] = stores.data?.results ?? [];

  const send = useMutation({
    mutationFn: async () =>
      (await trustApi.complaint({
        storefront: Number(storefront),
        subject: subject.trim(),
        description: description.trim(),
      })).data as { complaint?: { id: number; status_label?: string }; message?: string },
  });

  const ready = storefront !== '' && subject.trim().length > 2 && description.trim().length > 9;

  if (send.isSuccess) {
    return (
      <section
        className="rounded-lg border border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-night-soft"
        aria-live="polite"
      >
        <p className="flex items-center gap-2 text-xs font-extrabold text-brand-900 dark:text-brand-200">
          <CheckCircle2 size={16} aria-hidden="true" />
          شکایت ثبت شد
        </p>
        {typeof send.data?.complaint?.id === 'number' && (
          <p className="dateline mt-2 text-2xs text-ink-soft dark:text-white/70">
            شماره پیگیری:{' '}
            <strong className="font-extrabold text-ink dark:text-white">{nums(send.data.complaint.id)}</strong>
            {send.data.complaint.status_label && <span> · {send.data.complaint.status_label}</span>}
          </p>
        )}
      </section>
    );
  }

  if (!open) {
    return (
      <section className="rounded-lg border border-line bg-paper p-5 dark:border-night-line dark:bg-night-soft">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-ink dark:text-white">
          <ShieldAlert size={16} aria-hidden="true" className="text-brand-700 dark:text-brand-300" />
          شکایت از یک غرفه
        </h2>
        <p className="mt-1 text-2xs leading-6 text-ink-mute dark:text-white/50">
          اگر با غرفه‌ای به مشکل خوردید — کالای متفاوت، ارسال نشدن یا پاسخ‌نگرفتن — اینجا ثبت کنید. در
          صف رسیدگی قرار می‌گیرد و برایتان شمارهٔ پیگیری صادر می‌شود.
          {!signedIn && ' ثبت شکایت با حساب کاربری انجام می‌شود تا بتوانیم پاسخ را به شما برگردانیم.'}
        </p>
        <div className="mt-3">
          {signedIn ? (
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              ثبت شکایت
            </Button>
          ) : (
            <Link
              to="/login"
              className="inline-flex min-h-9 items-center rounded-sm border border-line px-3 text-2xs font-bold text-ink-soft transition-colors hover:border-brand-600 hover:text-brand-800 dark:border-night-line dark:text-white/60 dark:hover:text-brand-300"
            >
              برای ثبت شکایت وارد شوید
            </Link>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border border-line bg-paper p-5 dark:border-night-line dark:bg-night-soft"
      aria-labelledby="complaint-title"
    >
      <h2 id="complaint-title" className="text-base font-extrabold text-ink dark:text-white">
        شکایت از یک غرفه
      </h2>
      <form
        noValidate
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!ready || send.isPending) return;
          send.mutate();
        }}
      >
        <SelectField
          label="غرفه"
          required
          value={storefront}
          onChange={(event) => setStorefront(event.target.value)}
          error={touched && storefront === '' ? 'غرفه را انتخاب کنید.' : undefined}
        >
          <option value="">{stores.isLoading ? 'در حال بارگیری…' : 'انتخاب کنید'}</option>
          {options.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </SelectField>

        <TextField
          label="عنوان"
          required
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          hint="در یک خط: مشکل چه بود؟"
        />

        <TextArea
          label="شرح ماجرا"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="تاریخ، کد سفارش یا آگهی و آنچه میان شما و غرفه گذشته است."
        />

        {send.isError && (
          <p role="alert" className="text-2xs font-bold text-danger-700">
            {parseApiError(send.error).message}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" loading={send.isPending}>
            ثبت شکایت
          </Button>
          <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
            انصراف
          </Button>
        </div>
      </form>
    </section>
  );
}
