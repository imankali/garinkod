// frontend/src/pages/Affiliate.tsx

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Check, Share2 } from 'lucide-react';

import { affiliateApi } from '../api/services';
import { useAuthStore } from '../store/authStore';
import PageHead from '../components/shop/PageHead';
import Button from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { money } from '../lib/price';

/**
 * «همکاری در فروش».
 *
 * Signed out → the offer, and a link to log in (nothing here can be done
 * without an account). Signed in without a code → one button that creates the
 * profile. Signed in with a code → the code, the link, and the conversions the
 * API actually reports; no placeholder earnings.
 */
export default function Affiliate() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['affiliate', 'me'],
    queryFn: async () => (await affiliateApi.me()).data,
    enabled: Boolean(user),
  });

  const join = useMutation({
    mutationFn: async () => affiliateApi.join(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['affiliate', 'me'] }),
  });

  const profile = data?.profile ?? null;
  const conversions = data?.conversions ?? [];
  const referralLink = profile ? `${window.location.origin}/products?ref=${profile.code}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <PageHead
        title="همکاری در فروش"
        lead="لینک اختصاصی محصولات را با کشاورزانی که می‌شناسی به اشتراک بگذار. هر خرید انجام‌شده از لینک تو، سهم کمیسیون دارد و در پیشخوان ثبت می‌شود."
      />

      <section className="rounded-lg border border-line bg-paper p-5 dark:border-night-line dark:bg-night-soft" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-base font-extrabold text-ink dark:text-white">چطور کار می‌کند</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ['لینک بساز', 'پس از عضویت، یک کد اختصاصی می‌گیری که به انتهای آدرس محصولات می‌چسبد.'],
            ['اشتراک بگذار', 'لینک را در گروه کشاورزان، کانال یا پیام مستقیم بفرست.'],
            ['کمیسیون بگیر', 'هر سفارش تکمیل‌شده در پیشخوان همین صفحه با مبلغ کمیسیون ثبت می‌شود.'],
          ].map(([title, body], index) => (
            <li key={title} className="rounded-md bg-brand-50/70 p-3 dark:bg-night">
              <p className="text-2xs font-extrabold text-brand-800 dark:text-brand-300">{index + 1}. {title}</p>
              <p className="mt-1 text-2xs leading-6 text-ink-soft dark:text-white/60">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {!user ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper px-5 py-4 dark:border-night-line dark:bg-night-soft">
          <p className="text-xs font-bold text-ink dark:text-white">برای ساخت کد معرف، ابتدا وارد شوید.</p>
          <Button to="/login" size="sm" variant="secondary">
            ورود یا ثبت‌نام
          </Button>
        </div>
      ) : isLoading ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : !profile ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper px-5 py-4 dark:border-night-line dark:bg-night-soft">
          <div>
            <p className="text-xs font-extrabold text-ink dark:text-white">هنوز کد معرف نداری</p>
            <p className="mt-0.5 text-2xs text-ink-mute dark:text-white/50">عضویت یک‌مرحله‌ای است؛ کد بلافاصله صادر می‌شود.</p>
          </div>
          <Button size="sm" onClick={() => join.mutate()} loading={join.isPending}>
            ساخت کد معرف
          </Button>
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-night-soft" aria-labelledby="your-code">
            <h2 id="your-code" className="text-xs font-extrabold text-brand-900 dark:text-brand-100">کد معرف شما</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code
                dir="ltr"
                className="dateline rounded-md border border-brand-300 bg-paper px-3 py-2 text-sm font-extrabold tracking-wider text-ink dark:border-brand-700 dark:bg-night dark:text-white"
              >
                {profile.code}
              </code>
              <Button size="sm" variant="secondary" onClick={copy} icon={copied ? Check : Copy}>
                {copied ? 'کپی شد' : 'کپی لینک'}
              </Button>
              <span className="text-2xs text-ink-mute dark:text-white/50">
                کمیسیون {profile.commission_rate}٪ · وضعیت {profile.status_label}
              </span>
            </div>
            <p dir="ltr" className="mt-2 truncate text-2xs text-ink-soft dark:text-white/55">
              {referralLink}
            </p>
          </section>

          <section aria-labelledby="conversions">
            <h2 id="conversions" className="text-base font-extrabold text-ink dark:text-white">سفارش‌های معرفی‌شده</h2>
            {conversions.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-line px-4 py-6 text-xs text-ink-mute dark:border-night-line dark:text-white/50">
                <Share2 size={15} aria-hidden="true" />
                هنوز سفارشی از لینک تو ثبت نشده. لینک را جایی بفرست که کشاورز واقعی می‌خواند.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line border-y border-line dark:divide-night-line dark:border-night-line">
                {conversions.map((conversion) => (
                  <li key={conversion.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                    <span className="dateline font-extrabold text-ink dark:text-white">{conversion.order_code}</span>
                    <span className="text-ink-mute dark:text-white/50">{conversion.status_label}</span>
                    <span className="dateline font-extrabold text-brand-700 dark:text-brand-300">{money(conversion.commission_amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {join.isError && (
        <p role="alert" className="text-2xs font-bold text-danger-700">
          ساخت کد انجام نشد. دوباره تلاش کنید.
        </p>
      )}
    </div>
  );
}
