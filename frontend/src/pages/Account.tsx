// frontend/src/pages/Account.tsx

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { LogOut, MapPin, Package, Phone, User } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ordersApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { useAuthStore } from '../store/authStore';
import { money, nums } from '../lib/price';
import Button from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import RewardsPanel from '../components/shop/RewardsPanel';
import PushToggle from '../components/shop/PushToggle';
import PageHead from '../components/shop/PageHead';

/**
 * The account page: who you are, what you ordered, and the way out.
 *
 * It is deliberately not a dashboard. A buyer's account has three jobs —
 * edit the delivery details, see where an order is, sign out — and each is a
 * block on one page rather than a sidebar of eight sections, six of which
 * would be empty for most accounts.
 */
export default function Account() {
  const user = useAuthStore((state) => state.user);
  const account = useAuthStore((state) => state.account);
  const logout = useAuthStore((state) => state.logout);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!user) return;
    setFirstName(user.first_name ?? '');
    setLastName(user.last_name ?? '');
    setPhone(account?.phone ?? '');
    setAddress(account?.address ?? '');
  }, [user, account]);

  const orders = useQuery({
    queryKey: ['orders', 'account'],
    queryFn: async () => (await ordersApi.mine()).data,
    staleTime: 60 * 1000,
    enabled: Boolean(user),
  });

  /**
   * A rejected field is shown under its own input.
   *
   * The store already turns a validation error into `fields`, but the page was
   * printing one generic «ذخیره نشد» for all of them — so a phone number the
   * server refused looked like the form was broken rather than like the number
   * was wrong.
   */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      updateProfile({
        first_name: firstName,
        last_name: lastName,
        phone,
        address,
        email: user?.email ?? '',
        gender: account?.gender ?? 'male',
      }),
    onSuccess: () => {
      setFieldErrors({});
      void queryClient.invalidateQueries({ queryKey: ['session'] });
    },
    onError: (caught: unknown) => {
      // The store has already parsed the envelope; parsing it again here is
      // what turns a field-keyed refusal into a message under the right input.
      setFieldErrors(parseApiError(caught).fields);
    },
  });

  if (!user) {
    return (
      <div className="shell py-16">
        <EmptyState
          icon={User}
          title="برای دیدن حساب وارد شوید"
          description="سفارش‌ها، نشانی تحویل و اطلاعات تماس پشت همین ورود هستند."
          action={<Button to="/login" size="sm">ورود</Button>}
        />
      </div>
    );
  }

  const list = (orders.data ?? []).slice(0, 5);

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <PageHead
        title={[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
        lead={user.email || 'حساب خریدار گرین‌کود'}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={LogOut}
            onClick={() => {
              void logout();
            }}
          >
            خروج
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="profile-title" className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
          <h2 id="profile-title" className="text-sm font-extrabold text-ink dark:text-white">اطلاعات تحویل</h2>
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="نام"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                error={fieldErrors.first_name}
              />
              <TextField
                label="نام خانوادگی"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
                error={fieldErrors.last_name}
              />
            </div>
            <TextField
              label="شمارهٔ همراه"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              error={fieldErrors.phone}
              hint="برای هماهنگی ارسال و اطلاع از موجودی استفاده می‌شود."
            />
            {/* Whether the number is confirmed decides what the shop can promise
                by SMS, so it is stated rather than implied. */}
            {account?.phone && (
              <p className="-mt-2 text-2xs font-bold">
                {account.phone_verified_at ? (
                  <span className="text-brand-700 dark:text-brand-300">شماره تأیید شده است.</span>
                ) : (
                  <Link to="/login" className="text-gold-700 underline underline-offset-4 dark:text-gold-600">
                    این شماره هنوز تأیید نشده؛ با یک ورود پیامکی تأییدش کنید.
                  </Link>
                )}
              </p>
            )}
            <TextField
              label="نشانی تحویل"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              autoComplete="street-address"
              error={fieldErrors.address}
              hint="نشانی‌ای که سفارش‌ها به آن می‌رسد."
            />
            <div className="flex items-center gap-3">
              <Button type="submit" loading={save.isPending}>
                ذخیرهٔ تغییرات
              </Button>
              {save.isSuccess && <p className="text-2xs font-bold text-brand-700 dark:text-brand-300">ذخیره شد.</p>}
              {save.isError && Object.keys(fieldErrors).length === 0 && (
                <p role="alert" className="text-2xs font-bold text-danger-700">
                  ذخیره نشد؛ دوباره بزنید.
                </p>
              )}
            </div>
          </form>
        </section>

        <section aria-labelledby="orders-title" className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
          <div className="flex items-center justify-between">
            <h2 id="orders-title" className="text-sm font-extrabold text-ink dark:text-white">آخرین سفارش‌ها</h2>
            <Link to="/orders" className="text-2xs font-bold text-brand-700 hover:underline dark:text-brand-300">
              همهٔ سفارش‌ها
            </Link>
          </div>

          {orders.isLoading ? (
            <div className="mt-3 flex flex-col gap-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : list.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon={Package}
                title="هنوز سفارشی ثبت نشده"
                description="پس از نخستین خرید، سفارش و وضعیت ارسالش همین‌جا می‌ماند."
                action={<Button to="/products" size="sm" variant="secondary">دیدن کالاها</Button>}
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line dark:divide-night-line">
              {list.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="dateline text-xs font-bold text-ink dark:text-white">سفارش {order.code || `#${nums(order.id)}`}</p>
                    <p className="text-2xs text-ink-mute dark:text-white/45">{order.status_label || order.status}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="dateline text-xs font-extrabold text-ink dark:text-white">{money(order.total_price)}</span>
                    <Link
                      to={`/track?code=${order.code}`}
                      className="inline-flex min-h-9 items-center gap-1 rounded-sm border border-line px-2.5 text-2xs font-bold text-brand-700 transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50 dark:border-night-line dark:text-brand-300"
                    >
                      <MapPin size={12} aria-hidden="true" />
                      پیگیری
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 flex items-center gap-1.5 border-t border-line pt-3 text-2xs text-ink-mute dark:border-night-line dark:text-white/45">
            <Phone size={13} aria-hidden="true" />
            برای تغییر سفارش در حال آماده‌سازی، با پشتیبانی تماس بگیرید.
          </p>
        </section>

        {/* The seller studio is a level-3 promise in /api/levels/. Linking it
            from the account page is the only way a seller would find it: it is
            behind a session, so it has no place in the public footer. */}
        <section className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
          <p className="text-xs font-extrabold text-ink dark:text-white">فروش در گرین‌کود</p>
          <p className="mt-1 text-2xs leading-6 text-ink-mute dark:text-white/50">
            غرفه، آگهی محصول و وضعیت بررسی هر آگهی در استودیوی غرفه است.
          </p>
          <Button to="/studio" variant="secondary" size="sm" className="mt-2">
            استودیو غرفه
          </Button>
        </section>

        <RewardsPanel />

        <PushToggle />
      </div>
    </div>
  );
}
