// frontend/src/pages/About.tsx

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { BadgeCheck } from 'lucide-react';

import { siteInfoApi } from '../api/services';
import PageHead from '../components/shop/PageHead';
import { Skeleton } from '../components/ui/Skeleton';
import { nums } from '../lib/price';
import { landingPath } from '../lib/landing';

/**
 * «دربارهٔ ما».
 *
 * Opens with the one paragraph that says what the company is, then the numbers
 * the API counts from real rows (products, storefronts, provinces — not
 * marketing claims), then the people and the brands. Team photos are square
 * and small: the point is a name, not a portrait wall.
 */
export default function About() {
  const { data, isLoading } = useQuery({
    queryKey: ['site-about'],
    queryFn: async () => (await siteInfoApi.getAbout()).data,
    staleTime: 30 * 60 * 1000,
  });

  const stats = data?.stats;

  return (
    <div className="shell flex flex-col gap-8 py-8">
      <PageHead
        title="گرین‌کود، فروشگاه نهاده‌های کشاورزی"
        lead="کود، سم، بذر و ابزار کشاورزی را از تأمین‌کننده‌های شناخته‌شده می‌آوریم و کنار بازار مستقیم کشاورزان می‌گذاریم؛ تا انتخاب نهاده بر پایهٔ برگهٔ مشخصات و توصیهٔ کارشناس باشد، نه عکس تبلیغاتی."
      />

      {isLoading ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : (
        stats && (
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5 dark:border-night-line dark:bg-night-line">
            {[
              ['کالا', stats.products],
              ['غرفه‌دار', stats.storefronts],
              ['آگهی فعال', stats.listings],
              ['مقاله', stats.articles],
              ['استان', stats.provinces],
            ].map(([label, value]) => (
              <div key={label as string} className="bg-paper px-4 py-4 dark:bg-night-soft">
                <dt className="text-2xs text-ink-mute dark:text-white/45">{label}</dt>
                <dd className="dateline mt-1 text-xl font-extrabold text-ink dark:text-white">{nums(value as number)}</dd>
              </div>
            ))}
          </dl>
        )
      )}

      <section aria-labelledby="what-we-do" className="grid gap-5 lg:grid-cols-2">
        <div>
          <h2 id="what-we-do" className="text-base font-extrabold text-ink dark:text-white">چه کاری می‌کنیم</h2>
          <p className="mt-2 max-w-[65ch] text-sm leading-8 text-ink-soft dark:text-white/70">
            کاتالوگ ما نهاده‌های استاندارد است: کودهای پایه و محلول، سموم با دورهٔ کارنس مشخص، بذر گواهی‌شده و ابزار
            کوچک. برای هر کالا برگهٔ مشخصات، بسته‌بندی و هشدارهای ایمنی منتشر می‌شود و موجودی واقعی انبار نمایش داده
            می‌شود.
          </p>
          <p className="mt-3 max-w-[65ch] text-sm leading-8 text-ink-soft dark:text-white/70">
            بازار کشاورزان بخش دوم کار است: کشاورز و تعاونی مستقیماً محصولشان را آگهی می‌کنند و خریدار بدون واسطه با
            خودشان حرف می‌زند. غرفه‌ها پیش از انتشار بررسی می‌شوند و پس از فروش، تسویه در پیشخوان ثبت می‌شود.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-paper p-5 dark:border-night-line dark:bg-night-soft">
          <h3 className="text-xs font-extrabold text-ink dark:text-white">چیزهایی که ادعا نمی‌کنیم</h3>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 ps-4 text-2xs leading-6 text-ink-soft dark:text-white/60">
            <li>توصیهٔ «بهترین» نهاده؛ انتخاب به خاک، آب و مرحلهٔ رشد بستگی دارد.</li>
            <li>تحویل یک‌روزه به همهٔ استان‌ها؛ زمان ارسال به بار و مسیر وابسته است.</li>
            <li>قیمت ثابت برای بار عمده؛ نرخ‌ها هفتگی به‌روز می‌شوند.</li>
          </ul>
          <p className="mt-3 border-t border-line pt-3 text-2xs leading-6 text-ink-mute dark:border-night-line dark:text-white/45">
            اگر جایی این‌ها نقض شد، از صفحهٔ <Link to="/support" className="font-bold text-brand-700 underline underline-offset-4 dark:text-brand-300">پشتیبانی</Link> اطلاع بدهید.
          </p>
        </div>
      </section>

      {(data?.team ?? []).length > 0 && (
        <section aria-labelledby="team-title">
          <h2 id="team-title" className="text-base font-extrabold text-ink dark:text-white">تیم</h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.team ?? []).map((member) => (
              <li key={member.id} className="flex gap-3">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-brand-100 dark:bg-night">
                  {member.photo_url ? (
                    <img src={member.photo_url} alt="" width={48} height={48} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xs font-extrabold text-brand-800 dark:text-brand-300">
                      {member.name.slice(0, 2)}
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-ink dark:text-white">{member.name}</p>
                  <p className="text-2xs text-ink-mute dark:text-white/45">{member.role}</p>
                  {member.bio && <p className="mt-1 text-2xs leading-6 text-ink-soft dark:text-white/60">{member.bio}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(data?.brands ?? []).length > 0 && (
        <section aria-labelledby="brands-title">
          <h2 id="brands-title" className="text-base font-extrabold text-ink dark:text-white">برندهای همکار</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(data?.brands ?? []).map((brand) => (
              <li key={brand.id}>
                <Link
                  to={landingPath({ kind: 'brand', slug: brand.slug })}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line bg-paper px-3 text-2xs font-bold text-ink transition-colors duration-[var(--dur-state)] hover:border-brand-300 hover:bg-brand-50 dark:border-night-line dark:bg-night-soft dark:text-white dark:hover:border-brand-700"
                >
                  {brand.logo_url && (
                    <img src={brand.logo_url} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 object-contain" />
                  )}
                  {brand.name}
                  {brand.since_year && <span className="dateline font-medium text-ink-mute dark:text-white/40">از {nums(brand.since_year)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-5 py-4 dark:border-brand-800 dark:bg-night-soft">
        <p className="flex items-center gap-2 text-xs font-bold text-brand-900 dark:text-brand-100">
          <BadgeCheck size={15} aria-hidden="true" />
          سؤال فنی داری؟ کارشناس‌ها پاسخ می‌دهند.
        </p>
        <Link to="/contact" className="text-2xs font-extrabold text-brand-800 underline underline-offset-4 dark:text-brand-300">
          تماس با ما
        </Link>
      </section>
    </div>
  );
}
