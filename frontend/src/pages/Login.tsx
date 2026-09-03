// frontend/src/pages/Login.tsx

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  MessageSquareText,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { parseApiError } from '../api/errors';
import { useAuthStore } from '../store/authStore';
import type { OtpRequestResponse } from '../types';
import { normalizePhoneNumber, toEnglishDigits } from '../utils/normalizeDigits';

type AuthMethod = 'otp' | 'password';

interface PasswordFormData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  password2: string;
}

const AUTH_INPUT_CLASS = 'w-full rounded-xl border-2 border-slate-200 bg-white py-3 text-sm outline-none transition focus:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white';

const EMPTY_PASSWORD_FORM: PasswordFormData = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  password2: '',
};

export default function Login() {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('otp');
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>(EMPTY_PASSWORD_FORM);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<OtpRequestResponse | null>(null);
  const [otpError, setOtpError] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);

  const { login, register, requestOtp, verifyOtp, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(
      () => setResendSeconds((current) => Math.max(current - 1, 0)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function selectMethod(method: AuthMethod) {
    setAuthMethod(method);
    setOtpError('');
    if (method === 'otp') setIsRegister(false);
  }

  function handlePasswordChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    const cleanValue = name === 'username' ? toEnglishDigits(value).trim() : value;
    setPasswordForm((previous) => ({ ...previous, [name]: cleanValue }));
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    if (isRegister) {
      if (passwordForm.password !== passwordForm.password2) return;
      if (passwordForm.password.length < 8) return;
      try {
        await register(passwordForm);
        navigate('/');
      } catch {
        // The store presents password-auth errors exactly once.
      }
      return;
    }
    try {
      await login(passwordForm.username, passwordForm.password);
      navigate('/');
    } catch {
      // The store presents password-auth errors exactly once.
    }
  }

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    const normalisedPhone = normalizePhoneNumber(phone);
    if (!normalisedPhone) {
      setOtpError('شماره موبایل را وارد کنید.');
      return;
    }
    setOtpError('');
    try {
      const result = await requestOtp(normalisedPhone, 'auto');
      setPhone(normalisedPhone);
      setChallenge(result);
      setCode('');
      setResendSeconds(result.resend_after);
    } catch (error) {
      const parsed = parseApiError(error);
      setOtpError(parsed.fields.phone || parsed.message);
      if (parsed.retryAfter) setResendSeconds(parsed.retryAfter);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    const cleanCode = toEnglishDigits(code).replace(/\D/g, '');
    if (cleanCode.length < 4) {
      setOtpError('کد تأیید را کامل وارد کنید.');
      return;
    }
    setOtpError('');
    try {
      await verifyOtp({
        request_id: challenge.request_id,
        phone,
        code: cleanCode,
      });
      navigate('/');
    } catch (error) {
      const parsed = parseApiError(error);
      setOtpError(parsed.fields.code || parsed.message);
    }
  }

  function editPhone() {
    setChallenge(null);
    setCode('');
    setOtpError('');
    setResendSeconds(0);
  }

  const title = authMethod === 'otp'
    ? challenge ? 'تأیید شماره موبایل' : 'ورود یا ثبت‌نام سریع'
    : isRegister ? 'ثبت‌نام با رمز عبور' : 'ورود با رمز عبور';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-lime-50 px-4 py-12 dark:from-emerald-950 dark:to-emerald-900">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-md"
        aria-labelledby="auth-title"
      >
        <div className="rounded-3xl border border-white/70 bg-white p-6 shadow-2xl shadow-emerald-100 sm:p-8 dark:border-emerald-800 dark:bg-emerald-900/70 dark:shadow-none">
          <header className="mb-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-lime-500 text-white shadow-lg"
            >
              {authMethod === 'otp' ? <Phone size={28} /> : isRegister ? <UserPlus size={28} /> : <LogIn size={28} />}
            </motion.div>
            <h1 id="auth-title" className="text-2xl font-extrabold text-slate-800 dark:text-white">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-emerald-200">
              {authMethod === 'otp'
                ? 'بدون رمز عبور؛ کد امن از طریق پیامک یا بله ارسال می‌شود.'
                : 'روش قدیمی نام کاربری و رمز عبور همچنان در دسترس است.'}
            </p>
          </header>

          <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-emerald-950" role="tablist" aria-label="روش ورود">
            <button
              type="button"
              role="tab"
              aria-selected={authMethod === 'otp'}
              onClick={() => selectMethod('otp')}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
                authMethod === 'otp'
                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-800 dark:text-lime-300'
                  : 'text-slate-500 dark:text-emerald-300'
              }`}
            >
              <MessageSquareText size={17} /> کد یک‌بارمصرف
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMethod === 'password'}
              onClick={() => selectMethod('password')}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
                authMethod === 'password'
                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-800 dark:text-lime-300'
                  : 'text-slate-500 dark:text-emerald-300'
              }`}
            >
              <KeyRound size={17} /> رمز عبور
            </button>
          </div>

          {authMethod === 'otp' ? (
            challenge ? (
              <form onSubmit={submitCode} className="space-y-5" noValidate>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/70">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600 dark:text-lime-400" size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-emerald-900 dark:text-emerald-50">
                        کد برای <bdi dir="ltr">{challenge.masked_phone}</bdi> ارسال شد
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-700 dark:text-emerald-200">
                        کانال: {challenge.channel === 'bale' ? 'پیام‌رسان بله' : 'پیامک'} · اعتبار کد {Math.ceil(challenge.expires_in / 60)} دقیقه
                      </p>
                    </div>
                    <button type="button" onClick={editPhone} className="min-h-11 shrink-0 px-1 text-xs font-bold text-emerald-700 underline dark:text-lime-300">
                      ویرایش
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="otp-code" className="mb-2 block text-sm font-bold text-slate-700 dark:text-emerald-100">کد تأیید</label>
                  <input
                    id="otp-code"
                    name="one-time-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    dir="ltr"
                    value={code}
                    maxLength={8}
                    onChange={(event) => {
                      setCode(toEnglishDigits(event.target.value).replace(/\D/g, ''));
                      setOtpError('');
                    }}
                    aria-invalid={Boolean(otpError)}
                    aria-describedby={otpError ? 'otp-error' : undefined}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-center text-2xl font-black tracking-[0.45em] text-slate-800 outline-none transition focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-950 dark:text-white"
                    placeholder="------"
                  />
                  {challenge.debug_code && (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                      فقط محیط توسعه — کد: <bdi>{challenge.debug_code}</bdi>
                    </p>
                  )}
                </div>

                {otpError && <p id="otp-error" role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{otpError}</p>}

                <motion.button
                  type="submit"
                  disabled={isLoading || code.length < 4}
                  whileHover={{ scale: isLoading ? 1 : 1.01 }}
                  whileTap={{ scale: isLoading ? 1 : 0.99 }}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-none"
                >
                  {isLoading ? <Spinner /> : <><ShieldCheck size={19} /> تأیید و ورود</>}
                </motion.button>

                <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-emerald-200">
                  <span>کد را دریافت نکردید؟</span>
                  <button
                    type="button"
                    disabled={isLoading || resendSeconds > 0}
                    onClick={() => void sendCode()}
                    className="inline-flex min-h-11 items-center gap-1 px-1 font-bold text-emerald-700 disabled:text-slate-400 dark:text-lime-300 dark:disabled:text-emerald-700"
                  >
                    <RefreshCw size={15} />
                    {resendSeconds > 0 ? `${resendSeconds} ثانیه` : 'ارسال دوباره'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={sendCode} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="otp-phone" className="mb-2 block text-sm font-bold text-slate-700 dark:text-emerald-100">شماره موبایل</label>
                  <div className="relative">
                    <Phone size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="otp-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      dir="ltr"
                      value={phone}
                      onChange={(event) => {
                        setPhone(normalizePhoneNumber(event.target.value));
                        setOtpError('');
                      }}
                      aria-invalid={Boolean(otpError)}
                      aria-describedby={otpError ? 'otp-error' : 'otp-phone-help'}
                      className="w-full rounded-xl border-2 border-slate-200 bg-white py-3 pe-4 ps-10 text-left text-base font-bold outline-none transition focus:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
                      placeholder="09123456789"
                    />
                  </div>
                  <p id="otp-phone-help" className="mt-2 text-xs leading-5 text-slate-500 dark:text-emerald-300">
                    اگر حسابی با این شماره نداشته باشید، پس از تأیید به‌صورت امن ساخته می‌شود.
                  </p>
                </div>

                {otpError && <p id="otp-error" role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{otpError}</p>}

                <motion.button
                  type="submit"
                  disabled={isLoading || !phone}
                  whileHover={{ scale: isLoading ? 1 : 1.01 }}
                  whileTap={{ scale: isLoading ? 1 : 0.99 }}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-none"
                >
                  {isLoading ? <Spinner /> : <><MessageSquareText size={19} /> دریافت کد ورود <ArrowRight size={18} /></>}
                </motion.button>

                <div className="flex items-start gap-2 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:bg-emerald-950/60 dark:text-emerald-200">
                  <ShieldCheck className="mt-1 shrink-0 text-emerald-600 dark:text-lime-400" size={18} />
                  کد کوتاه‌عمر است، در سرور به‌صورت هش نگهداری می‌شود و با تعداد تلاش و ارسال محدود محافظت می‌شود.
                </div>
              </form>
            )
          ) : (
            <form onSubmit={submitPassword} className="space-y-4">
              <Field label="نام کاربری" htmlFor="login-username" icon={<User size={18} />}>
                <input
                  type="text"
                  name="username"
                  id="login-username"
                  value={passwordForm.username}
                  onChange={handlePasswordChange}
                  required
className={`${AUTH_INPUT_CLASS} ps-10`}
                  placeholder="نام کاربری خود را وارد کنید"
                  autoComplete="username"
                />
              </Field>

              {isRegister && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <PlainField label="نام" htmlFor="login-first-name">
                      <input id="login-first-name" type="text" name="first_name" value={passwordForm.first_name} onChange={handlePasswordChange} className={`${AUTH_INPUT_CLASS} px-4`} autoComplete="given-name" />
                    </PlainField>
                    <PlainField label="نام خانوادگی" htmlFor="login-last-name">
                      <input id="login-last-name" type="text" name="last_name" value={passwordForm.last_name} onChange={handlePasswordChange} className={`${AUTH_INPUT_CLASS} px-4`} autoComplete="family-name" />
                    </PlainField>
                  </div>
                  <Field label="ایمیل" htmlFor="login-email" icon={<Mail size={18} />}>
                    <input id="login-email" type="email" name="email" value={passwordForm.email} onChange={handlePasswordChange} required className={`${AUTH_INPUT_CLASS} ps-10`} placeholder="example@email.com" dir="ltr" autoComplete="email" />
                  </Field>
                </>
              )}

              <Field label="رمز عبور" htmlFor="login-password" icon={<Lock size={18} />}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={passwordForm.password}
                  onChange={handlePasswordChange}
                  required
                  minLength={isRegister ? 8 : undefined}
                  className={`${AUTH_INPUT_CLASS} ps-10 pe-12`}
                  placeholder="رمز عبور"
                  dir="ltr"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
                <PasswordToggle shown={showPassword} onClick={() => setShowPassword((shown) => !shown)} />
              </Field>

              {isRegister && (
                <Field label="تکرار رمز عبور" htmlFor="login-password2" icon={<Lock size={18} />}>
                  <input
                    id="login-password2"
                    type={showPassword2 ? 'text' : 'password'}
                    name="password2"
                    value={passwordForm.password2}
                    onChange={handlePasswordChange}
                    required
                    minLength={8}
                    className={`${AUTH_INPUT_CLASS} ps-10 pe-12`}
                    placeholder="تکرار رمز عبور"
                    dir="ltr"
                    autoComplete="new-password"
                  />
                  <PasswordToggle shown={showPassword2} onClick={() => setShowPassword2((shown) => !shown)} />
                </Field>
              )}

              {isRegister && passwordForm.password2 && passwordForm.password !== passwordForm.password2 && (
                <p role="alert" className="text-xs font-semibold text-rose-600">رمزهای عبور مطابقت ندارند.</p>
              )}

              <motion.button
                type="submit"
                disabled={isLoading || (isRegister && passwordForm.password !== passwordForm.password2)}
                whileHover={{ scale: isLoading ? 1 : 1.01 }}
                whileTap={{ scale: isLoading ? 1 : 0.99 }}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-none"
              >
                {isLoading ? <Spinner /> : isRegister ? <><UserPlus size={18} /> ثبت‌نام</> : <><LogIn size={18} /> ورود</>}
              </motion.button>

              <div className="pt-2 text-center text-sm text-slate-500 dark:text-emerald-300">
                {isRegister ? 'قبلاً ثبت‌نام کرده‌اید؟' : 'حساب رمزدار ندارید؟'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister((current) => !current);
                    setPasswordForm(EMPTY_PASSWORD_FORM);
                  }}
                  className="inline-flex min-h-11 items-center px-1 font-bold text-emerald-700 dark:text-lime-300"
                >
                  {isRegister ? 'ورود' : 'ثبت‌نام کلاسیک'}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.section>
    </main>
  );
}

function Spinner() {
  return <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-label="در حال انجام" />;
}

function Field({ label, htmlFor, icon, children }: { label: string; htmlFor: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-emerald-200">{label}</label>
      <div className="relative">
        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function PlainField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-emerald-200">{label}</label>
      {children}
    </div>
  );
}

function PasswordToggle({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute end-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-emerald-300"
      aria-label={shown ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'}
    >
      {shown ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}
