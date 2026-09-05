// frontend/src/components/NewsletterForm.tsx
//
// Newsletter opt-in. It posts to the API only — no provider is contacted here,
// and delivery stays behind the messaging outbox that the backend already
// throttles and records, so the UI never promises an e-mail the deployment does
// not send.

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Mail, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

import { newsletterApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { normalizePhoneNumber, toEnglishDigits } from '../utils/normalizeDigits';
import { cn } from '../utils/cn';

type Channel = 'email' | 'mobile';

export default function NewsletterForm({
  source = 'footer',
  variant = 'footer',
  topics,
}: {
  /** Where the sign-up came from, stored with the row for auditing. */
  source?: string;
  /** `footer` is the compact dark block; `panel` is the standalone card. */
  variant?: 'footer' | 'panel';
  /** Optional topic chips the visitor can tick. */
  topics?: string[];
}) {
  const [channel, setChannel] = useState<Channel>(variant === 'footer' ? 'email' : 'mobile');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanMobile = channel === 'mobile' ? normalizePhoneNumber(mobile) : '';
    const cleanEmail = channel === 'email' ? email.trim() : '';
    if (!cleanMobile && !cleanEmail) {
      toast.error(channel === 'mobile' ? 'شماره موبایل معتبر وارد کنید.' : 'ایمیل معتبر وارد کنید.');
      return;
    }
    setBusy(true);
    try {
      await newsletterApi.subscribe({
        email: cleanEmail || undefined,
        mobile: cleanMobile || undefined,
        topics: selected.join('، '),
        source,
      });
      setDone(true);
      setEmail('');
      setMobile('');
      toast.success('عضویت شما ثبت شد.');
    } catch (error) {
      toast.error(parseApiError(error).message || 'ثبت‌نام انجام نشد. لطفاً دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p
        className={cn(
          'flex items-center gap-2 rounded-xl px-3 py-2.5 text-fluid-xs font-bold',
          variant === 'footer'
            ? 'bg-emerald-900/60 text-lime-200'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-lime-300',
        )}
      >
        <CheckCircle2 size={16} />
        عضویت ثبت شد. تازه‌ترین راهنماها و پیشنهادها را برای شما می‌فرستیم.
      </p>
    );
  }

  const inputClass = cn(
    'w-full rounded-xl border px-3 py-2.5 text-fluid-sm outline-none transition',
    variant === 'footer'
      ? 'border-emerald-800 bg-emerald-900/60 text-white placeholder:text-emerald-300/60 focus:border-lime-400'
      : 'border-slate-200 bg-white text-slate-700 focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white',
  );

  return (
    <form onSubmit={submit} className="space-y-2.5">
      {variant === 'panel' && (
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-emerald-900/60">
          {(
            [
              { id: 'mobile', label: 'موبایل', icon: Smartphone },
              { id: 'email', label: 'ایمیل', icon: Mail },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setChannel(option.id)}
              className={cn(
                'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-fluid-xs font-bold transition-colors',
                channel === option.id
                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-lime-300'
                  : 'text-slate-500 dark:text-emerald-300',
              )}
            >
              <option.icon size={15} />
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {channel === 'email' ? (
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            aria-label="ایمیل برای خبرنامه"
            className={inputClass}
          />
        ) : (
          <input
            type="tel"
            dir="ltr"
            inputMode="numeric"
            value={mobile}
            onChange={(event) => setMobile(toEnglishDigits(event.target.value))}
            placeholder="09121234567"
            aria-label="شماره موبایل برای خبرنامه"
            className={inputClass}
          />
        )}
        <button
          type="submit"
          disabled={busy}
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-fluid-xs font-bold transition disabled:opacity-60',
            variant === 'footer'
              ? 'bg-lime-400 text-emerald-950 hover:bg-lime-300'
              : 'bg-emerald-600 text-white hover:bg-emerald-700',
          )}
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          عضویت
        </button>
      </div>

      {topics && topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {topics.map((topic) => {
            const active = selected.includes(topic);
            return (
              <button
                key={topic}
                type="button"
                onClick={() =>
                  setSelected((current) => (active ? current.filter((item) => item !== topic) : [...current, topic]))
                }
                className={cn(
                  'min-h-9 rounded-full border px-3 text-fluid-2xs font-bold transition-colors',
                  active
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-lime-300'
                    : 'border-slate-200 text-slate-500 hover:border-emerald-300 dark:border-emerald-800 dark:text-emerald-300',
                )}
                aria-pressed={active}
              >
                {topic}
              </button>
            );
          })}
        </div>
      )}

      <p className={cn('text-fluid-2xs leading-6', variant === 'footer' ? 'text-emerald-300/80' : 'text-slate-400')}>
        فقط اطلاع‌رسانی قیمت و راهنمای کشت؛ لغو عضویت با یک کلیک از همان پیام ممکن است.
      </p>
    </form>
  );
}
