// frontend/src/components/layout/NewsletterForm.tsx

import { useState } from 'react';
import { Check } from 'lucide-react';

import { newsletterApi } from '../../api/services';

/**
 * Newsletter signup: one field, one button, one sentence of result.
 *
 * It asks for an email OR a mobile — the shop's customers are farmers, and
 * half of them would rather get a text. The success line says what happens
 * next rather than "ثبت شد", and a failure keeps the typed value so nobody
 * retypes it.
 */
export default function NewsletterForm() {
  const [value, setValue] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const entry = value.trim();
    if (!entry || state === 'busy') return;
    const isEmail = entry.includes('@');
    setState('busy');
    setError(null);
    try {
      await newsletterApi.subscribe({
        ...(isEmail ? { email: entry } : { mobile: entry }),
        source: 'footer',
      });
      setState('done');
      setValue('');
    } catch {
      setState('idle');
      setError('ثبت نشد. ایمیل یا شمارهٔ همراه را بررسی کنید و دوباره بزنید.');
    }
  }

  if (state === 'done') {
    return (
      <p className="flex items-center gap-2 text-xs font-bold text-brand-100">
        <Check size={15} aria-hidden="true" />
        ثبت شد. خبرنامهٔ فصل کشت و تخفیف‌ها به همین نشانی می‌رسد.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-md">
      <label htmlFor="newsletter" className="block text-xs font-extrabold text-white">
        خبرنامهٔ گرین‌کود
      </label>
      <p id="newsletter-hint" className="mt-1 text-[11px] text-brand-100/70">
        تقویم فصل کشت، هشدار آفات و تخفیف‌های تازه — ماهی یک ایمیل، بدون تبلیغ پرت.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id="newsletter"
          type="text"
          inputMode="email"
          autoComplete="email"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-describedby="newsletter-hint"
          placeholder="ایمیل یا شمارهٔ همراه"
          className="h-11 w-full rounded-md border border-white/20 bg-white/10 px-3.5 text-[16px] text-white placeholder:text-brand-100/50 transition-colors duration-150 focus:border-white/50 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/20 sm:text-sm"
        />
        <button
          type="submit"
          disabled={!value.trim() || state === 'busy'}
          className="h-11 shrink-0 rounded-md bg-white px-4 text-xs font-extrabold text-brand-900 transition-colors duration-150 hover:bg-brand-100 disabled:opacity-50"
        >
          {state === 'busy' ? '…' : 'عضویت'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[11px] font-medium text-brand-100">
          {error}
        </p>
      )}
    </form>
  );
}
