// frontend/src/components/LoginModal.tsx
//
// In-place sign-in. Components call `useAuthModalStore.openAuthModal({ reason })`
// instead of pushing the visitor to /login, so the product they were reading —
// and the review they were writing — is still there after they authenticate.
//
// It reuses the auth store (the same OTP and password paths as /login) rather
// than duplicating the flow; /login remains for deep links, the PWA start URL
// and anyone who wants the full-page experience with registration.

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Loader2, LogIn, Phone, ShieldCheck } from 'lucide-react';

import { parseApiError } from '../api/errors';
import Modal from './ui/Modal';
import { useAuthModalStore } from '../store/authModalStore';
import { useAuthStore } from '../store/authStore';
import type { OtpRequestResponse } from '../types';
import { normalizePhoneNumber, toEnglishDigits } from '../utils/normalizeDigits';

const INPUT =
  'w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white';

export default function LoginModal() {
  const { open, reason, next, close } = useAuthModalStore();
  const { login, requestOtp, verifyOtp, isAuthenticated, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<OtpRequestResponse | null>(null);
  const [error, setError] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [method, setMethod] = useState<'otp' | 'password'>('otp');

  // A fresh dialog every time it opens, and nothing to do once signed in.
  useEffect(() => {
    if (!open) return;
    setError('');
    setCode('');
    setChallenge(null);
  }, [open]);

  useEffect(() => {
    if (isAuthenticated && open) {
      close();
      if (next && next !== window.location.pathname + window.location.search) {
        navigate(next);
      }
    }
  }, [isAuthenticated, open, next, close, navigate]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setResendSeconds((current) => Math.max(current - 1, 0)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    const clean = normalizePhoneNumber(phone);
    if (!clean) {
      setError('شماره موبایل را کامل وارد کنید.');
      return;
    }
    setError('');
    try {
      const result = await requestOtp(clean, 'auto');
      setPhone(clean);
      setChallenge(result);
      setResendSeconds(result.resend_after);
    } catch (caught) {
      const parsed = parseApiError(caught);
      setError(parsed.fields.phone || parsed.message);
      if (parsed.retryAfter) setResendSeconds(parsed.retryAfter);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    const cleanCode = toEnglishDigits(code).replace(/\D/g, '');
    if (cleanCode.length < 4) {
      setError('کد تأیید را کامل وارد کنید.');
      return;
    }
    setError('');
    try {
      await verifyOtp({ request_id: challenge.request_id, phone, code: cleanCode });
      close();
    } catch (caught) {
      const parsed = parseApiError(caught);
      setError(parsed.fields.code || parsed.message);
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('نام کاربری و رمز عبور را وارد کنید.');
      return;
    }
    setError('');
    try {
      await login(username.trim(), password);
      close();
    } catch (caught) {
      setError(parseApiError(caught).message);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={challenge ? 'تأیید شماره موبایل' : 'ورود به گرین کود'}
      description={
        reason ||
        'برای ثبت دیدگاه، مشاوره و خرید، وارد حساب خود شوید؛ در همین صفحه می‌مانید.'
      }
      size="sm"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-emerald-900/60" role="tablist" aria-label="روش ورود">
          {(
            [
              { id: 'otp', label: 'کد یک‌بارمصرف', icon: Phone },
              { id: 'password', label: 'رمز عبور', icon: KeyRound },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={method === option.id}
              onClick={() => {
                setMethod(option.id);
                setError('');
              }}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-fluid-xs font-bold transition ${
                method === option.id
                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-lime-300'
                  : 'text-slate-500 dark:text-emerald-300'
              }`}
            >
              <option.icon size={15} />
              {option.label}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-fluid-xs font-bold text-rose-600 dark:bg-rose-950/60 dark:text-rose-200">
            {error}
          </p>
        )}

        {method === 'otp' && !challenge && (
          <form onSubmit={sendCode} className="space-y-3">
            <label className="block text-fluid-xs font-bold text-slate-600 dark:text-emerald-100">
              شماره موبایل
              <input
                dir="ltr"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(toEnglishDigits(event.target.value))}
                placeholder="09121234567"
                className={`mt-1.5 ${INPUT}`}
                autoComplete="tel"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-fluid-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              دریافت کد تأیید
            </button>
            <p className="flex items-start gap-1.5 text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-300">
              <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-600 dark:text-lime-300" />
              اگر شماره شما حساب نداشته باشد، هم‌زمان با تأیید کد یک حساب ساخته می‌شود.
            </p>
          </form>
        )}

        {method === 'otp' && challenge && (
          <form onSubmit={submitCode} className="space-y-3">
            <p className="text-fluid-xs text-slate-500 dark:text-emerald-200">
              کد ۴ رقمی به شماره <strong dir="ltr">{challenge.masked_phone}</strong> ارسال شد
              {challenge.channel === 'bale' ? ' (پیام‌رسان بله)' : ' (پیامک)'} .
            </p>
            <input
              dir="ltr"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(toEnglishDigits(event.target.value))}
              placeholder="••••"
              aria-label="کد تأیید"
              className={`${INPUT} text-center text-lg tracking-[0.5em]`}
              autoComplete="one-time-code"
              autoFocus
            />
            {challenge.debug_code && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-fluid-2xs text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
                حالت توسعه — کد فعلی: <strong dir="ltr">{challenge.debug_code}</strong>
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-fluid-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <LogIn size={16} />
                ورود
              </button>
              <button
                type="button"
                onClick={() => setChallenge(null)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-fluid-xs font-bold text-slate-600 dark:border-emerald-700 dark:text-emerald-100"
              >
                <ArrowLeft size={15} />
                تغییر شماره
              </button>
            </div>
            <button
              type="button"
              disabled={resendSeconds > 0 || isLoading}
              onClick={() => void sendCode()}
              className="text-fluid-2xs font-bold text-emerald-700 underline disabled:opacity-50 dark:text-lime-300"
            >
              {resendSeconds > 0 ? `ارسال دوباره کد تا ${resendSeconds.toLocaleString('fa-IR')} ثانیه دیگر` : 'ارسال دوباره کد'}
            </button>
          </form>
        )}

        {method === 'password' && (
          <form onSubmit={submitPassword} className="space-y-3">
            <input
              dir="ltr"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="نام کاربری"
              aria-label="نام کاربری"
              className={INPUT}
              autoComplete="username"
            />
            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="رمز عبور"
              aria-label="رمز عبور"
              className={INPUT}
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-fluid-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              ورود
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                navigate('/login');
              }}
              className="w-full text-fluid-2xs font-bold text-emerald-700 underline dark:text-lime-300"
            >
              ثبت‌نام یا مشکل ورود با رمز عبور؟ صفحه کامل ورود
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
