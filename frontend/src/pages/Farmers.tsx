// frontend/src/pages/Farmers.tsx

import { Link } from 'react-router';
import { ArrowLeft, BadgeCheck, Banknote, ClipboardCheck, MessageCircle } from 'lucide-react';

import PageHead from '../components/shop/PageHead';
import Button from '../components/ui/Button';

/**
 * «فروش محصول» — the seller page.
 *
 * It answers the four questions a farmer actually asks before signing up:
 * what does it cost, who checks my listing and how long that takes, when do I
 * get paid, and how do buyers reach me. Written as plain paragraphs under
 * four headings — no icon-card grid, no numbered timeline, no testimonials
 * carousel.
 */
const STEPS = [
  {
    icon: ClipboardCheck,
    title: '۱. ثبت‌نام با مدارک',
    body: 'نام، شمارهٔ همراه، کد ملی و شمارهٔ کارت برای تسویه. مدارک یک‌بار بررسی می‌شود و بعد از تأیید، غرفه فعال است.',
  },
  {
    icon: BadgeCheck,
    title: '۲. ثبت آگهی و بررسی',
    body: 'برای هر محصول: عنوان، مقدار موجود، واحد فروش، قیمت و عکس. آگهی پیش از انتشار بررسی می‌شود تا خریدار بداند موجودی و کیفیت را چه کسی تضمین کرده.',
  },
  {
    icon: MessageCircle,
    title: '۳. گفتگو با خریدار',
    body: 'خریدار از صفحهٔ غرفه یا صفحهٔ آگهی پیام می‌دهد. موجودی، زمان برداشت و هزینهٔ ارسال همان‌جا نهایی می‌شود.',
  },
  {
    icon: Banknote,
    title: '۴. تسویه',
    body: 'پس از تحویل و تأیید سفارش، مبلغ به کارت ثبت‌شده واریز می‌شود. کارمزد و سهم پلتفرم پیش از تأیید سفارش در پیشخوان دیده می‌شود.',
  },
] as const;

export default function Farmers() {
  return (
    <div className="shell flex flex-col gap-8 py-8">
      <PageHead
        title="محصولت را مستقیم بفروش"
        lead="غرفه‌داری در گرین‌کود برای کشاورز، تعاونی و تولیدکننده است: آگهی می‌گذارید، خریدار مستقیم با شما حرف می‌زند و پرداخت پس از تحویل تسویه می‌شود."
        actions={
          <Button to="/login" size="md">
            شروع غرفه‌داری
          </Button>
        }
      />

      <ol className="grid gap-4 sm:grid-cols-2">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
            <Icon size={18} aria-hidden="true" className="text-brand-700 dark:text-brand-300" />
            <h2 className="mt-2 text-xs font-extrabold text-ink dark:text-white">{title}</h2>
            <p className="mt-1 text-2xs leading-7 text-ink-soft dark:text-white/60">{body}</p>
          </li>
        ))}
      </ol>

      <section aria-labelledby="farmer-faq" className="rounded-lg border border-line bg-paper p-5 dark:border-night-line dark:bg-night-soft">
        <h2 id="farmer-faq" className="text-base font-extrabold text-ink dark:text-white">پرسش‌های رایج کشاورزان</h2>
        <dl className="mt-3 divide-y divide-line dark:divide-night-line">
          {[
            ['هزینهٔ غرفه‌داری چقدر است؟', 'ثبت‌نام و ساخت غرفه رایگان است؛ پلتفرم درصدی از هر فروش موفق برمی‌دارد که پیش از تأیید سفارش در پیشخوان نمایش داده می‌شود.'],
            ['بررسی آگهی چقدر طول می‌کشد؟', 'معمولاً کمتر از یک روز کاری. اگر آگهی برگشت بخورد، دلیلش نوشته می‌شود تا همان را اصلاح کنید.'],
            ['بدون عکس حرفه‌ای هم می‌شود؟', 'بله. عکس واضح با نور روز از خود محصول کافی است؛ عکس تبلیغاتی لازم نیست.'],
            ['ارسال با کیست؟', 'برای بارهای کوچک، پست و باربری؛ برای بارهای عمده، هماهنگی مستقیم با خریدار در گفتگو.'],
          ].map(([term, value]) => (
            <div key={term} className="py-3">
              <dt className="text-xs font-extrabold text-ink dark:text-white">{term}</dt>
              <dd className="mt-1 text-2xs leading-7 text-ink-soft dark:text-white/60">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-5 py-4 dark:border-brand-800 dark:bg-night-soft">
        <p className="text-xs font-bold text-brand-900 dark:text-brand-100">
          غرفه‌ای داری؟ ثبت‌نام را از همین‌جا شروع کن؛ مدارک یک‌بار بررسی می‌شود.
        </p>
        <Link
          to="/storefronts"
          className="inline-flex min-h-9 items-center gap-1.5 text-2xs font-extrabold text-brand-800 transition-colors hover:text-brand-900 dark:text-brand-300"
        >
          نمونهٔ غرفه‌های فعال
          <ArrowLeft size={13} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
