// frontend/src/pages/Support.tsx

import { useQuery } from '@tanstack/react-query';
import { Mail, MessageSquare, Phone } from 'lucide-react';

import { siteInfoApi } from '../api/services';
import PageHead from '../components/shop/PageHead';
import SupportForm from '../components/shop/SupportForm';
import StorefrontComplaintForm from '../components/shop/StorefrontComplaintForm';
import { Skeleton } from '../components/ui/Skeleton';
import { telHref } from '../lib/phone';

/**
 * Support: how to reach a human, in the order most people need it.
 *
 * Phone first (the buyer with a delivery problem), then the message form link,
 * then email (the buyer with a receipt question). The API's contact block is
 * the only source of the numbers — a hardcoded phone on a support page is how
 * a site ends up publishing a number nobody answers.
 */
export default function Support() {
  const { data, isLoading } = useQuery({
    queryKey: ['site-contact'],
    queryFn: async () => (await siteInfoApi.getContact()).data,
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <PageHead
        title="پشتیبانی"
        lead={
          // «هر پیام یک شمارهٔ پیگیری می‌گیرد» was a promise with no form to keep
          // it; the sentence now describes what the page below actually does.
          data?.working_hours
            ? `سفارش، موجودی، مرجوعی یا شکایت از یک غرفه — از هر کدام شروع کنید. پاسخ‌گویی در ساعات کاری: ${data.working_hours}.`
            : 'سفارش، موجودی، مرجوعی یا شکایت از یک غرفه — از هر کدام شروع کنید. هر پیام در صف رسیدگی ثبت می‌شود و پاسخ به ایمیل شما می‌آید.'
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: Phone,
              title: 'تماس تلفنی',
              body: 'برای مشکل فوری در تحویل یا تأیید موجودی.',
              rows: (data?.phones ?? []).map((phone) => ({
                label: 'تلفن',
                value: phone,
                href: telHref(phone),
              })),
            },
            {
              icon: MessageSquare,
              title: 'پیام و گفتگو',
              body: 'برای شکایت از غرفه یا سؤال دربارهٔ یک آگهی، از صفحهٔ همان غرفه پیام بدهید.',
              rows: [{ label: 'گفتگو با غرفه', value: 'از صفحهٔ غرفه', href: '/storefronts' }],
            },
            {
              icon: Mail,
              title: 'ایمیل',
              body: 'برای اسناد، فاکتور رسمی و موضوع‌های غیرفوری.',
              rows: (data?.emails ?? []).map((email) => ({
                label: 'ایمیل',
                value: email,
                href: `mailto:${email}`,
              })),
            },
          ].map(({ icon: Icon, title, body, rows }) => (
            <section
              key={title}
              className="flex flex-col gap-2 rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft"
              aria-label={title}
            >
              <Icon size={18} aria-hidden="true" className="text-brand-700 dark:text-brand-300" />
              <h2 className="text-xs font-extrabold text-ink dark:text-white">{title}</h2>
              <p className="text-2xs leading-6 text-ink-mute dark:text-white/50">{body}</p>
              <ul className="mt-auto space-y-1 border-t border-line pt-2 dark:border-night-line">
                {rows.length === 0 && <li className="text-2xs text-ink-mute dark:text-white/40">در حال به‌روزرسانی</li>}
                {rows.map((row) => (
                  <li key={`${row.label}-${row.value}`}>
                    <a
                      href={row.href}
                      className="dateline inline-flex min-h-8 items-center gap-1.5 text-2xs font-bold text-brand-700 transition-colors hover:text-brand-900 dark:text-brand-300"
                      dir={row.href.startsWith('tel:') || row.href.startsWith('mailto:') ? 'ltr' : undefined}
                    >
                      <span className="text-ink-mute dark:text-white/40">{row.label}:</span>
                      {row.value}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section className="rounded-lg border border-line bg-paper p-5 dark:border-night-line dark:bg-night-soft" aria-labelledby="returns-title">
        <h2 id="returns-title" className="text-base font-extrabold text-ink dark:text-white">پیش از تماس، این‌ها را بدانید</h2>
        <dl className="mt-3 divide-y divide-line text-xs dark:divide-night-line">
          {[
            ['پیگیری سفارش', 'با کد سفارش و شمارهٔ همراه، در صفحهٔ پیگیری، وضعیت و اقلام را ببینید.'],
            ['موجودی کالا', 'موجودی پیش از پرداخت تأیید می‌شود؛ اگر کالایی ناموجود باشد، سفارش اصلاح یا لغو می‌شود.'],
            ['شکایت از غرفه', 'از صفحهٔ همان غرفه پیام ثبت کنید، یا اگر دسترسی ندارید، از فرم همین صفحه با موضوع «انتقاد یا شکایت» بفرستید.'],
            ['مرجوعی', 'شرایط و مهلت بازگشت در صفحهٔ شرایط بازگشت کالا آمده است.'],
          ].map(([term, value]) => (
            <div key={term} className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr]">
              <dt className="font-extrabold text-ink dark:text-white">{term}</dt>
              <dd className="leading-7 text-ink-soft dark:text-white/60">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <SupportForm />

      <StorefrontComplaintForm />
    </div>
  );
}
