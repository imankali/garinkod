// frontend/src/pages/Newsletter.tsx
//
// The newsletter landing page: what the list actually sends, an opt-in for
// either channel, and an honest unsubscribe box. Both halves talk to the API —
// no third-party form embed — so a sign-up lands in the same table a campaign
// manager exports from the admin.

import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Mail, Newspaper, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

import RouteSeo from '../components/RouteSeo';
import ArticleCard from '../components/article/ArticleCard';
import { articlesApi, newsletterApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { normalizePhoneNumber, toEnglishDigits } from '../utils/normalizeDigits';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../utils/cn';

const TOPICS = [
  'قیمت روزنه‌اده‌ها',
  'ورود بذر و کود تازه',
  'راهنمای کشت فصل',
  'تخفیف و فروش ویژه',
  'وبینار و مشاوره رایگان',
];

const PROMISES = [
  {
    title: 'هفته‌ای یک پیام',
    text: 'خلاصه تغییر قیمت نهاده‌ها و موجودی انبار، بدون تبلیغ روزانه و بدون پیامک شبانه.',
  },
  {
    title: 'همان راهنمایی که در صفحه کالا لازم است',
    text: 'راهنمای کشت و یادآوری دوز مصرف، درست در فصلی که باید تصمیم بگیرید.',
  },
  {
    title: 'هر وقت خواستید خارج شوید',
    text: 'لینک لغو عضویت در پایین هر پیام هست و شماره یا ایمیل شما در فهرست فعال می‌ماند تا دوباره اذیت نشوید.',
  },
];

type Channel = 'email' | 'mobile';

export default function Newsletter() {
  const [channel, setChannel] = useState<Channel>('mobile');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [selected, setSelected] = useState<string[]>([TOPICS[0]!]);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [leaveValue, setLeaveValue] = useState('');
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [searchParams] = useSearchParams();

  const { data: latest = [] } = useQuery({
    queryKey: ['newsletter-latest'],
    queryFn: async () => (await articlesApi.getAll({ limit: 3 })).data,
    staleTime: 10 * 60 * 1000,
  });

  // A campaign link may arrive as /newsletter?unsubscribe=1&email=... ; the
  // visitor should not have to type the address again to leave.
  useEffect(() => {
    if (searchParams.get('unsubscribe') !== '1') return;
    const target = searchParams.get('email') || searchParams.get('mobile') || '';
    if (!target) return;
    if (target.includes('@')) {
      setChannel('email');
      setEmail(target);
    } else {
      setChannel('mobile');
      setMobile(target);
    }
    setLeaveValue(target);
  }, [searchParams]);

  async function join(event: FormEvent) {
    event.preventDefault();
    const cleanMobile = channel === 'mobile' ? normalizePhoneNumber(mobile) : '';
    const cleanEmail = channel === 'email' ? email.trim() : '';
    if (!cleanMobile && !cleanEmail) {
      toast.error(channel === 'mobile' ? 'شماره موبایل را کامل کنید.' : 'ایمیل معتبر وارد کنید.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await newsletterApi.subscribe({
        email: cleanEmail || undefined,
        mobile: cleanMobile || undefined,
        topics: selected.join('، '),
        source: 'newsletter-page',
      });
      setJoined(true);
      toast.success(data.message || 'عضویت شما ثبت شد.');
    } catch (error) {
      toast.error(parseApiError(error).message || 'ثبت‌نام انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  async function leave(event: FormEvent) {
    event.preventDefault();
    const value = leaveValue.trim();
    if (!value) {
      toast.error('ایمیل یا شماره موبایل خود را وارد کنید.');
      return;
    }
    setLeaveBusy(true);
    try {
      const isEmail = value.includes('@');
      const { data } = await newsletterApi.unsubscribe(
        isEmail ? { email: value } : { mobile: normalizePhoneNumber(value) },
      );
      toast.success(
        data.count
          ? 'عضویت شما لغو شد؛ از این پس پیامی دریافت نمی‌کنید.'
          : 'نشانی در فهرست خبرنامه پیدا نشد.',
      );
      setLeaveValue('');
    } catch (error) {
      toast.error(parseApiError(error).message || 'لغو عضویت انجام نشد.');
    } finally {
      setLeaveBusy(false);
    }
  }

  return (
    <main className="page-shell py-8 md:py-10">
      <RouteSeo />

      <header className="overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-900 via-emerald-800 to-emerald-600 p-6 text-white sm:p-9">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-fluid-2xs font-bold">
          <Newspaper size={13} />
          خبرنامه گرین کود
        </span>
        <h1 className="mt-3 text-fluid-2xl font-extrabold leading-12">
          قیمت نهاده‌ها را قبل از خرید بسنجید، نه بعد از ضرر
        </h1>
        <p className="mt-3 max-w-3xl text-fluid-sm leading-8 text-emerald-50">
          فهرست خبرنامه گرین کود برای کشاورز و تعاونی ساخته شده است: یک پیام در هفته با تغییر قیمت کود و سم،
          موجودی تازه انبار، و راهنمای کشت همان فصل. ایمیل یا شماره موبایل خود را انتخاب کنید.
        </p>
      </header>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          {PROMISES.map((item) => (
            <article
              key={item.title}
              className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"
            >
              <h2 className="flex items-center gap-2 text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                <CheckCircle2 size={17} className="text-emerald-600 dark:text-lime-300" />
                {item.title}
              </h2>
              <p className="mt-2 text-fluid-sm leading-8 text-slate-500 dark:text-emerald-200">{item.text}</p>
            </article>
          ))}

          {latest.length > 0 && (
            <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
              <h2 className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                نمونه‌ای از آنچه ارسال می‌شود
              </h2>
              <div className="mt-3 space-y-2">
                {latest.map((article) => (
                  <ArticleCard key={article.id} article={article} variant="row" />
                ))}
              </div>
              <Link
                to="/blog"
                className="mt-3 inline-flex min-h-10 items-center text-fluid-xs font-bold text-emerald-700 underline dark:text-lime-300"
              >
                آرشیو کامل بلاگ
              </Link>
            </article>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
            {joined ? (
              <div className="text-center">
                <CheckCircle2 size={30} className="mx-auto text-emerald-600 dark:text-lime-300" />
                <p className="mt-3 text-fluid-sm font-extrabold text-slate-800 dark:text-white">عضو شدید</p>
                <p className="mt-2 text-fluid-xs leading-7 text-slate-500 dark:text-emerald-200">
                  از این هفته، خلاصه قیمت و راهنمای کشت را در {channel === 'mobile' ? 'پیامک' : 'ایمیل'} خود
                  می‌بینید. موضوع‌های انتخابی شما هم ثبت شد.
                </p>
                <button
                  type="button"
                  onClick={() => setJoined(false)}
                  className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-emerald-200 px-3 text-fluid-2xs font-bold text-emerald-700 dark:border-emerald-800 dark:text-lime-300"
                >
                  افزودن کانال دیگر
                </button>
              </div>
            ) : (
              <form onSubmit={join} className="space-y-3">
                <p className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">عضویت در خبرنامه</p>
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-emerald-900/60">
                  {(
                    [
                      { id: 'mobile', label: 'موبایل', icon: Smartphone },
                      { id: 'email', label: 'ایمیل', icon: Mail },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setChannel(option.id)}
                      className={cn(
                        'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-fluid-xs font-bold transition-colors',
                        channel === option.id
                          ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-lime-300'
                          : 'text-slate-500 dark:text-emerald-300',
                      )}
                    >
                      <option.icon size={15} />
                      {option.label}
                    </button>
                  ))}
                </div>

                {channel === 'mobile' ? (
                  <input
                    type="tel"
                    dir="ltr"
                    inputMode="numeric"
                    value={mobile}
                    onChange={(event) => setMobile(toEnglishDigits(event.target.value))}
                    placeholder="09121234567"
                    aria-label="شماره موبایل"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-fluid-sm outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
                  />
                ) : (
                  <input
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    aria-label="ایمیل"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-fluid-sm outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
                  />
                )}

                <div>
                  <p className="text-fluid-2xs font-bold text-slate-500 dark:text-emerald-300">موضوع‌های مورد علاقه</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {TOPICS.map((topic) => {
                      const active = selected.includes(topic);
                      return (
                        <button
                          key={topic}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setSelected((current) =>
                              active ? current.filter((item) => item !== topic) : [...current, topic],
                            )
                          }
                          className={cn(
                            'min-h-9 rounded-full border px-3 text-fluid-2xs font-bold transition-colors',
                            active
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-lime-300'
                              : 'border-slate-200 text-slate-500 hover:border-emerald-300 dark:border-emerald-800 dark:text-emerald-300',
                          )}
                        >
                          {topic}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-fluid-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy && <Loader2 size={15} className="animate-spin" />}
                  عضویت در خبرنامه
                </button>
                <p className="text-fluid-2xs leading-6 text-slate-400">
                  شماره و ایمیل فقط برای همین اطلاع‌رسانی استفاده می‌شود و در اختیار طرف سوم قرار نمی‌گیرد.
                </p>
              </form>
            )}
          </div>

          <div className="rounded-3xl bg-slate-50 p-5 dark:bg-emerald-900/30">
            <p className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">لغو عضویت</p>
            <p className="mt-1 text-fluid-2xs leading-7 text-slate-500 dark:text-emerald-200">
              اگر دیگر پیام‌ها را نمی‌خواهید، همان نشانی را که ثبت کرده بودید وارد کنید؛ رکورد برای حسابداری
              نگه داشته می‌شود ولی از فهرست ارسال بیرون می‌رود.
            </p>
            <form onSubmit={leave} className="mt-3 flex gap-2">
              <input
                dir="ltr"
                value={leaveValue}
                onChange={(event) => setLeaveValue(toEnglishDigits(event.target.value))}
                placeholder="email یا 0912..."
                aria-label="ایمیل یا موبایل برای لغو عضویت"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-950 dark:text-white"
              />
              <button
                type="submit"
                disabled={leaveBusy}
                className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-300 px-3 text-fluid-xs font-bold text-slate-600 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60 dark:border-emerald-700 dark:text-emerald-100"
              >
                لغو
              </button>
            </form>
          </div>
        </aside>
      </div>
    </main>
  );
}
