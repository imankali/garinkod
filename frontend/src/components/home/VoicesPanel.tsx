// frontend/src/components/home/VoicesPanel.tsx
//
// What buyers actually said, on the front page.
//
// `/api/testimonials/` has been serving this from the first commit — fourteen
// rated reviews at the time of writing — with three tiers the server chose and
// named: `curated` (an editor pinned them), `verified` (a paid buyer wrote
// them) and `open` (rated well, no purchase behind them). Nothing rendered it.
//
// The tier is the whole point, so it is stated in words rather than implied by
// a badge. The one thing this must never do is let an `open` review look like a
// `verified` one: the server sends `verified_purchase` per row, and the header
// names the tier, because a testimonial strip is the easiest place on a site to
// mislead a buyer about who is speaking.
//
// A review says where it came from: the product it was written about links to
// that product, so a visitor can go and read the rest of its reviews.

import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Quote, Star } from 'lucide-react';
import { Link } from 'react-router';

import { testimonialsApi } from '../../api/services';
import SectionHead from './SectionHead';
import { cn } from '../../lib/cn';
import { nums } from '../../lib/price';

const MODE_COPY: Record<'curated' | 'verified' | 'open', { title: string; hint: string }> = {
  curated: {
    title: 'تجربهٔ خریداران',
    hint: 'گزیدهٔ ویرایشگر از میان نظرهای ثبت‌شده روی کالاها — با نام نویسنده و کالایی که دربارهٔ آن است.',
  },
  verified: {
    title: 'تجربهٔ خریداران',
    hint: 'همهٔ این نظرها از سفارش‌های پرداخت‌شدهٔ همین کالاها آمده‌اند؛ نه متن تبلیغاتی.',
  },
  open: {
    // Deliberately different wording: these have no purchase behind them yet.
    title: 'نظر کاربران',
    hint: 'نظرهای ثبت‌شده روی کالاها. خرید این کاربران هنوز تأیید نشده است.',
  },
};

function Stars({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${score} از ۵`} dir="ltr">
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          size={11}
          aria-hidden="true"
          className={cn(
            step <= Math.round(score) ? 'fill-gold-600 text-gold-600' : 'text-line dark:text-night-line',
          )}
        />
      ))}
    </span>
  );
}

export default function VoicesPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['testimonials'],
    queryFn: async () => (await testimonialsApi.list()).data,
    staleTime: 10 * 60 * 1000,
  });

  const items = data?.items ?? [];
  if (isLoading || items.length === 0) return null;

  const mode = data?.mode ?? 'open';
  const copy = MODE_COPY[mode];
  // Three on a desk, four on a wide screen — an odd number leaves a ragged row
  // at the bottom, and the server sends enough for either.
  const shown = items.slice(0, 4);

  return (
    <section aria-labelledby="voices-title" className="section shell">
      <SectionHead
        id="voices-title"
        title={copy.title}
        hint={copy.hint}
        action={{ to: '/products', label: 'کالاها و نظرهایشان' }}
      />

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((item) => (
          <li
            key={item.id}
            className="flex h-full flex-col gap-2 rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft"
          >
            <Quote size={16} aria-hidden="true" className="text-brand-300 dark:text-brand-700" />

            <p className="line-clamp-4 text-2xs leading-6 text-ink-soft dark:text-white/70">{item.body}</p>

            <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-2 dark:border-night-line">
              <span className="text-2xs font-extrabold text-ink dark:text-white">{item.name}</span>
              {item.verified_purchase && (
                <span
                  className="inline-flex items-center gap-1 rounded-sm bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-800 dark:bg-night dark:text-brand-300"
                  title="این کاربر کالا را خریده است"
                >
                  <BadgeCheck size={10} aria-hidden="true" />
                  خرید تأییدشده
                </span>
              )}
              {item.rating != null && <Stars score={item.rating} />}
            </div>

            <Link
              to={`/product/${item.product.slug}`}
              className="line-clamp-1 text-[11px] text-ink-mute transition-colors hover:text-brand-800 dark:text-white/45 dark:hover:text-brand-300"
            >
              {item.product.title}
            </Link>
          </li>
        ))}
      </ul>

      {data && data.total > 0 && (
        <p className="dateline mt-2 text-2xs text-ink-mute dark:text-white/40">
          {nums(items.length)} از {nums(data.total)} نظر ثبت‌شده روی این کالاها.
        </p>
      )}
    </section>
  );
}
