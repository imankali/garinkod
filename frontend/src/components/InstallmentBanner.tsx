import { Calendar, Handshake, Landmark, Percent } from "lucide-react";

const PHONE_NUMBER = import.meta.env.VITE_PHONE_NUMBER || "02112345678";

/**
 * Commercial finance is intentionally presented as a pre-registration service
 * until credit scoring, contracts and a payment provider exist server-side.
 */
export default function InstallmentBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-4 md:grid-cols-2">
        <article className="flex flex-col justify-between rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/50 p-6 shadow-md dark:border-emerald-900/40 dark:from-[#08392a] dark:to-[#052e22]">
          <div>
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-[#0F8A5F] dark:bg-emerald-900 dark:text-lime-300">
              <Calendar size={13} /> پیش‌ثبت‌نام خرید اعتباری
            </span>
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-white md:text-xl">تأمین اعتباری برای فصل کشت</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-emerald-200">
              شرایط اعتبار، چک صیادی، زمان بازپرداخت و هزینه‌ها پس از بررسی درخواست و پیش از هر قرارداد به‌صورت شفاف اعلام می‌شود.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-emerald-900/40">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#0F8A5F] dark:text-lime-300"><Landmark size={14} /> هنوز پیشنهاد مالی قطعی صادر نشده است</span>
            <a href={`tel:${PHONE_NUMBER}`} className="rounded-xl bg-[#0F8A5F] px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-[#064E3B]">گفت‌وگو با کارشناس</a>
          </div>
        </article>

        <article className="flex flex-col justify-between rounded-3xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/40 p-6 shadow-md dark:border-amber-900/30 dark:from-[#08392a] dark:to-[#1a2e15]">
          <div>
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"><Percent size={13} /> تأمین عمده B2B</span>
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-white md:text-xl">استعلام خرید عمده برای مزرعه، تعاونی و کسب‌وکار</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-emerald-200">
              حجم سفارش، شرایط تحویل، فاکتور، کیفیت و قیمت عمده باید برای هر درخواست بررسی و به‌صورت کتبی تأیید شود؛ تخفیف خودکار نمایش داده نمی‌شود.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-emerald-900/40">
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300"><Handshake size={14} /> درخواست و قرارداد شفاف</span>
            <a href="/services" className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-amber-700">ثبت درخواست عمده</a>
          </div>
        </article>
      </div>
    </section>
  );
}
