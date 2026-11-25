// frontend/src/pages/Auth.tsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { KeyRound, Smartphone } from 'lucide-react';

import { useAuthStore } from '../store/authStore';
import { parseApiError } from '../api/errors';
import { TextField } from '../components/ui/Field';
import Button from '../components/ui/Button';
import { cn } from '../lib/cn';

/**
 * Sign in — one card, one question at a time.
 *
 * Two methods exist (password and a one-time code over SMS/Bale) and the page
 * lets the visitor choose before it asks for anything, instead of printing
 * both forms at once. The code flow has two states in the same place:
 * request, then verify — never a second page that loses the phone number.
 *
 * Errors come from the API's own message (`parseApiError`), which names the
 * field that failed; nothing is re-invented client-side.
 */
export default function Auth() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const requestOtp = useAuthStore((state) => state.requestOtp);
  const verifyOtp = useAuthStore((state) => state.verifyOtp);

  const [method, setMethod] = useState<'otp' | 'password'>('otp');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function run(task: () => Promise<void>, after: () => void) {
    setBusy(true);
    setError(null);
    try {
      await task();
      after();
    } catch (caught) {
      setError(parseApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell flex justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-ink dark:text-white">ورود به گرین‌کود</h1>
        <p className="mt-2 text-xs leading-7 text-ink-mute dark:text-white/55">
          با شمارهٔ همراه وارد شوید یا از نام کاربری و رمز استفاده کنید. اگر حساب ندارید، همین‌جا ساخته می‌شود.
        </p>

        <div role="tablist" aria-label="روش ورود" className="mt-6 grid grid-cols-2 gap-1 rounded-md bg-brand-50 p-1 dark:bg-night-soft">
          {[
            { key: 'otp' as const, label: 'کد پیامکی', icon: Smartphone },
            { key: 'password' as const, label: 'رمز عبور', icon: KeyRound },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={method === key}
              onClick={() => {
                setMethod(key);
                setError(null);
              }}
              className={cn(
                'flex min-h-10 items-center justify-center gap-1.5 rounded-sm text-xs font-bold transition-colors duration-150',
                method === key
                  ? 'bg-paper text-brand-800 shadow-sm dark:bg-night dark:text-brand-300'
                  : 'text-ink-mute hover:text-ink dark:text-white/55 dark:hover:text-white',
              )}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {method === 'otp' ? (
            requestId === null ? (
              <>
                <TextField
                  label="شمارهٔ همراه"
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="09xxxxxxxxx"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  hint="کد امن به همین شماره پیامک می‌شود."
                />
                <Button
                  size="lg"
                  full
                  loading={busy}
                  onClick={() =>
                    run(
                      async () => {
                        const result = await requestOtp(phone);
                        setRequestId(result.request_id);
                      },
                      () => undefined,
                    )
                  }
                >
                  دریافت کد
                </Button>
              </>
            ) : (
              <>
                <TextField
                  label="کد پیامک‌شده"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="------"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  hint={`کد به ${phone} ارسال شد.`}
                />
                <Button
                  size="lg"
                  full
                  loading={busy}
                  onClick={() =>
                    run(
                      () => verifyOtp({ request_id: requestId, phone, code }),
                      () => navigate('/account'),
                    )
                  }
                >
                  ورود
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setRequestId(null);
                    setCode('');
                  }}
                  className="text-2xs font-bold text-brand-700 hover:text-brand-900 dark:text-brand-300"
                >
                  شماره را عوض می‌کنم
                </button>
              </>
            )
          ) : (
            <>
              <TextField
                label="نام کاربری"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <TextField
                label="رمز عبور"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button
                size="lg"
                full
                loading={busy}
                onClick={() => run(() => login(username, password), () => navigate('/account'))}
              >
                ورود
              </Button>
            </>
          )}

          {error && (
            <p role="alert" className="rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-2xs font-medium text-danger-700 dark:bg-danger-700/15 dark:text-danger-600">
              {error}
            </p>
          )}

          <p className="text-2xs text-ink-mute dark:text-white/45">
            ورود به معنای پذیرش{' '}
            <Link to="/legal/terms" className="font-bold text-brand-700 hover:underline dark:text-brand-300">قوانین</Link>{' '}
            و{' '}
            <Link to="/legal/privacy" className="font-bold text-brand-700 hover:underline dark:text-brand-300">حریم خصوصی</Link>{' '}
            است.
          </p>
        </div>
      </div>
    </div>
  );
}
