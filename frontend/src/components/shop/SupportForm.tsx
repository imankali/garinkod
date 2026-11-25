// frontend/src/components/shop/SupportForm.tsx
//
// The message form the support page always implied and never had.
//
// The page's own lead promised «هر پیام یک شمارهٔ پیگیری میگیرد», the FAQ sent
// people to «پیام ثبت کنید تا ... شمارهٔ پیگیری بگیرد», and `trustApi.feedback`
// had been wired to POST /api/feedback/ from the start. But there was no form on
// the page: the only ways to reach a human were a phone number and an email
// address. So the number a visitor was promised could never be created.
//
// Two corrections came out of building it:
//   • The endpoint returns the note's `id` and a status, not a tracking code.
//     The UI therefore shows the reference the server actually issues and calls
//     it what it is («شماره پیگیری: ۱۲»), instead of inventing an order-like code.
//   • The promise of follow-up needs somewhere to land, so the form asks for an
//     email or a mobile and says plainly that the reply goes there.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';

import { trustApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import type { PlatformFeedbackPayload } from '@/types/content';
import { toEnglishDigits } from '../../lib/phone';
import { nums } from '../../lib/price';
import Button from '../ui/Button';
import { SelectField, TextArea, TextField } from '../ui/Field';

const KINDS: Array<{ value: PlatformFeedbackPayload['kind']; label: string }> = [
  { value: 'other', label: 'سفارش و ارسال' },
  { value: 'consultation', label: 'مشاورهٔ خرید' },
  { value: 'criticism', label: 'انتقاد یا شکایت' },
  { value: 'suggestion', label: 'پیشنهاد' },
];

export default function SupportForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState<PlatformFeedbackPayload['kind']>('other');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);

  const send = useMutation({
    mutationFn: async () =>
      (await trustApi.feedback({
        name: name.trim(),
        email: email.trim() || undefined,
        kind,
        subject: subject.trim(),
        message: message.trim(),
      })).data as { feedback?: { id: number }; message?: string },
  });

  // One field is required beyond the text: without a reply address the note
  // cannot be answered, and «پاسخ میدهیم» would be a claim with no route home.
  const contactMissing = email.trim().length === 0;
  const ready = subject.trim().length > 2 && message.trim().length > 9 && !contactMissing;

  if (send.isSuccess) {
    const reference = send.data?.feedback?.id;
    return (
      <section
        className="rounded-lg border border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-night-soft"
        aria-live="polite"
      >
        <p className="flex items-center gap-2 text-xs font-extrabold text-brand-900 dark:text-brand-200">
          <CheckCircle2 size={16} aria-hidden="true" />
          پیام شما ثبت شد
        </p>
        {typeof reference === 'number' && (
          <p className="dateline mt-2 text-2xs text-ink-soft dark:text-white/70">
            شماره پیگیری: <strong className="font-extrabold text-ink dark:text-white">{nums(reference)}</strong>
          </p>
        )}
        <p className="mt-1 text-2xs leading-6 text-ink-soft dark:text-white/65">
          پاسخ به {email.trim()} فرستاده می‌شود. این شماره را نگه دارید تا اگر لازم شد، گفتگو را از همان
          جا ادامه دهیم.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border border-line bg-paper p-5 dark:border-night-line dark:bg-night-soft"
      aria-labelledby="support-form-title"
    >
      <h2 id="support-form-title" className="text-base font-extrabold text-ink dark:text-white">
        پیام به پشتیبانی
      </h2>
      <p className="mt-1 text-2xs leading-6 text-ink-mute dark:text-white/50">
        اگر تماس تلفنی ممکن نیست، همین‌جا بنویسید. هر پیام در صف رسیدگی ثبت می‌شود و پاسخ به نشانی
        ایمیل شما می‌آید.
      </p>

      <form
        // Native validation would stop the submit before our own check ran, so
        // the visitor saw a browser bubble instead of the line that explains
        // *why* the address is needed. One validation path, ours.
        noValidate
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!ready || send.isPending) return;
          send.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="نام"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
          />
          <TextField
            label="ایمیل برای پاسخ"
            type="email"
            required
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(toEnglishDigits(event.target.value))}
            autoComplete="email"
            error={touched && contactMissing ? 'برای دریافت پاسخ، ایمیل لازم است.' : undefined}
          />
        </div>

        <SelectField
          label="موضوع"
          value={kind}
          onChange={(event) => setKind(event.target.value as PlatformFeedbackPayload['kind'])}
        >
          {KINDS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <TextField
          label="عنوان"
          required
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          hint="مثلاً: سفارش GK-TEST-0001 دو هفته است نرسیده"
        />

        <TextArea
          label="متن پیام"
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="کد سفارش، نام کالا و آنچه اتفاق افتاده را بنویسید تا بدون پرسش دوباره بررسی کنیم."
        />

        {send.isError && (
          <p role="alert" className="text-2xs font-bold text-danger-700">
            {parseApiError(send.error).message}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={send.isPending}>
            ارسال پیام
          </Button>
          {!ready && (subject.length > 0 || message.length > 0) && (
            <span className="text-2xs text-ink-mute dark:text-white/45">
              عنوان و متن پیام را کامل کنید.
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
