import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, RotateCcw, ShieldCheck } from 'lucide-react';

import ArticleBody from '../components/article/ArticleBody';
import { sitePagesApi } from '../api/services';

// The wording below is what ships with the code, so a fresh deployment never
// shows an empty legal page. Publishing a SitePage whose slug matches the route
// (`privacy`, `terms`, `returns`) replaces these sections with the editable
// blocks from the admin — legal text then follows the same content pipeline as
// every other page, including the audit trail on each block.
const LEGAL_PAGE_SLUGS: Record<string, string> = {
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/returns': 'returns',
};

type LegalDocument = {
  title: string;
  intro: string;
  icon: typeof ShieldCheck;
  sections: Array<{ title: string; body: string }>;
};

const DOCUMENTS: Record<string, LegalDocument> = {
  '/privacy': {
    title: 'حریم خصوصی و حفاظت از داده‌ها',
    intro: 'این صفحه توضیح می‌دهد گرین کود چه داده‌هایی را برای ارائه فروشگاه و خدمات کشاورزی پردازش می‌کند.',
    icon: ShieldCheck,
    sections: [
      { title: 'داده‌های مورد نیاز', body: 'اطلاعات حساب، شماره تماس، نشانی تحویل، سفارش‌ها، پیام‌های پشتیبانی و داده‌های فنی ضروری برای امنیت و کارکرد سرویس پردازش می‌شوند. اطلاعات پرداخت بانکی در گرین کود ذخیره نمی‌شود و پرداخت آنلاین در صفحه ارائه‌دهنده پرداخت انجام می‌گیرد.' },
      { title: 'هدف استفاده', body: 'داده‌ها برای ایجاد حساب، اجرای سفارش، ارسال و رهگیری، پاسخ‌گویی، جلوگیری از سوءاستفاده، ثبت سوابق مالی و انجام تکالیف قانونی استفاده می‌شوند. فروش یا اجاره اطلاعات شخصی به تبلیغ‌دهندگان بخشی از مدل سرویس نیست.' },
      { title: 'ارائه‌دهندگان', body: 'تنها در صورت فعال‌سازی و ضرورت، داده محدود با ارائه‌دهندگان پرداخت، ارسال، پیام‌رسانی، ذخیره‌سازی، پایش خطا یا آمار بازدید به اشتراک گذاشته می‌شود. هر اتصال خارجی تا پیش از تنظیم معتبر غیرفعال است.' },
      { title: 'اعلان و آمار بازدید', body: 'اعلان مرورگر فقط با اجازه صریح شما فعال می‌شود و از تنظیمات حساب قابل حذف است. آمار بازدید اختیاری نیز فقط پس از رضایت شما بارگذاری می‌شود و رد کردن آن مانع استفاده از سایت نیست.' },
      { title: 'نگهداری و درخواست شما', body: 'اطلاعات فقط تا زمانی که برای ارائه سرویس، امنیت، حل اختلاف یا الزامات حسابداری و قانونی لازم باشد نگهداری می‌شود. برای مشاهده، اصلاح یا درخواست حذف داده‌های غیرالزامی از صفحه پشتیبانی با ما تماس بگیرید.' },
    ],
  },
  '/terms': {
    title: 'شرایط استفاده و ثبت سفارش',
    intro: 'استفاده از حساب و ثبت سفارش به معنی پذیرش قواعد شفاف زیر است.',
    icon: FileText,
    sections: [
      { title: 'قیمت و موجودی', body: 'قیمت‌ها در سایت به تومان نمایش داده می‌شوند. مبلغ، موجودی، تخفیف و هزینه ارسال هنگام ثبت سفارش دوباره توسط سرور محاسبه می‌شوند. خطای آشکار فنی یا قیمتی پیش از پذیرش نهایی سفارش قابل اصلاح و اطلاع‌رسانی است.' },
      { title: 'پرداخت', body: 'فقط روشی که در همان لحظه فعال نمایش داده می‌شود قابل استفاده است. پرداخت آنلاین تنها پس از تأیید مستقل ارائه‌دهنده و ثبت موفق در سفارش قطعی تلقی می‌شود. کد سفارش یا تصویر رسید به‌تنهایی اثبات پرداخت نیست.' },
      { title: 'حساب و محتوا', body: 'کاربر مسئول صحت اطلاعات تحویل و حفاظت از دسترسی حساب خود است. انتشار محتوای غیرقانونی، گمراه‌کننده، ناقض حقوق دیگران یا استفاده خودکار مخرب ممنوع است. آگهی‌های بازار ممکن است پیش از انتشار بررسی شوند.' },
      { title: 'راهنمای کشاورزی', body: 'اطلاعات محاسباتی و محتوای سایت جایگزین برچسب رسمی محصول، مقررات محلی یا نظر کارشناس حاضر در مزرعه نیست. دوز و روش مصرف باید با محصول، شرایط مزرعه و دستورالعمل ایمنی تطبیق داده شود.' },
    ],
  },
  '/returns': {
    title: 'لغو، مرجوعی و بازگشت وجه',
    intro: 'وضعیت کالا و پرداخت تعیین می‌کند درخواست لغو یا مرجوعی چگونه بررسی شود.',
    icon: RotateCcw,
    sections: [
      { title: 'پیش از پرداخت و ارسال', body: 'سفارش پرداخت‌نشده‌ای که درخواست پرداخت فعال ندارد، تا زمانی که وارد مرحله غیرقابل بازگشت آماده‌سازی نشده باشد از صفحه سفارش قابل لغو است و موجودی رزروشده آزاد می‌شود.' },
      { title: 'پس از پرداخت', body: 'سفارش پرداخت‌شده مستقیماً لغو نمی‌شود و ابتدا باید درخواست بازگشت وجه بررسی شود. بازپرداخت فقط از مسیر ثبت‌شده و متناسب با روش پرداخت اصلی انجام می‌شود؛ اطلاعات محرمانه بانکی را در پیام ارسال نکنید.' },
      { title: 'کالای آسیب‌دیده یا مغایر', body: 'در اولین فرصت از بسته و برچسب کالا تصویر تهیه کنید و کد سفارش، شرح مغایرت و وضعیت بسته‌بندی را برای پشتیبانی بفرستید. کالا را تا اعلام نتیجه مصرف یا معدوم نکنید.' },
      { title: 'کالاهای حساس', body: 'امکان مرجوعی نهاده بازشده، مصرف‌شده، فاسدشدنی یا کالایی که نگهداری آن خارج از شرایط درج‌شده بوده است، به وضعیت کالا و مقررات لازم‌الاجرا وابسته است. حقوق اجباری مصرف‌کننده با این متن محدود نمی‌شود.' },
    ],
  },
};

export default function Legal() {
  const location = useLocation();
  const document = DOCUMENTS[location.pathname] ?? DOCUMENTS['/terms']!;
  const Icon = document.icon;
  const editableSlug = LEGAL_PAGE_SLUGS[location.pathname];
  const { data: override } = useQuery({
    queryKey: ['legal-page', editableSlug],
    queryFn: async () => (await sitePagesApi.getBySlug(editableSlug as string)).data,
    enabled: Boolean(editableSlug),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const blocks = override?.blocks || [];
  return (
    <div className="page-shell py-8 md:py-12">
      <header className="max-w-3xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300"><Icon /></span>
        <h1 className="mt-4 text-fluid-2xl font-extrabold text-slate-800 dark:text-white">{override?.title || document.title}</h1>
        <p className="mt-3 leading-7 text-slate-500 dark:text-emerald-200">{override?.hero_text || document.intro}</p>
        <p className="mt-2 text-fluid-xs text-slate-400">
          آخرین بازبینی:{' '}
          {override
            ? new Date(override.updated_at).toLocaleDateString('fa-IR')
            : 'شهریور ۱۴۰۵'}
        </p>
      </header>
      <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_250px]">
        <div className="space-y-4">
          {blocks.length > 0 &&
            blocks.map((block) => (
              <section
                key={block.id}
                className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-6"
              >
                {block.title && (
                  <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">{block.title}</h2>
                )}
                {block.block_type === 'bullets' ? (
                  <ul className="mt-2 space-y-2 text-fluid-sm leading-8 text-slate-600 dark:text-emerald-100">
                    {block.text
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line) => (
                        <li key={line}>• {line}</li>
                      ))}
                  </ul>
                ) : (
                  <div className="mt-2">
                    <ArticleBody body={block.text} />
                  </div>
                )}
              </section>
            ))}

          {blocks.length === 0 &&
            document.sections.map((section) => (
            <section key={section.title} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-6">
              <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">{section.title}</h2>
              <p className="mt-2 text-fluid-sm leading-8 text-slate-600 dark:text-emerald-100">{section.body}</p>
            </section>
          ))}
        </div>
        <nav aria-label="اسناد حقوقی" className="h-fit rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-900/40">
          <p className="text-sm font-extrabold text-slate-800 dark:text-white">صفحات مرتبط</p>
          <div className="mt-2 flex flex-col">
            <Link className="min-h-11 py-3 text-sm font-bold text-emerald-700 dark:text-lime-300" to="/privacy">حریم خصوصی</Link>
            <Link className="min-h-11 py-3 text-sm font-bold text-emerald-700 dark:text-lime-300" to="/terms">شرایط استفاده</Link>
            <Link className="min-h-11 py-3 text-sm font-bold text-emerald-700 dark:text-lime-300" to="/returns">لغو و مرجوعی</Link>
            <Link className="min-h-11 py-3 text-sm font-bold text-emerald-700 dark:text-lime-300" to="/support">تماس با پشتیبانی</Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
