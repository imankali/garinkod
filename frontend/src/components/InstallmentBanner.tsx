// frontend/src/components/InstallmentBanner.tsx

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator, Calendar, CheckCircle2, Handshake, Percent, X } from "lucide-react";
import { formatPrice } from "../utils/formatPrice";
import toast from "react-hot-toast";

// ========================================
// Types
// ========================================
type Months = 4 | 6;

interface AppliedPromo {
  code: string;
  percent: number;
}

// ========================================
// Constants
// ========================================
const PROFIT_RATES: Record<Months, number> = {
  4: 0.08,  // 8% برای 4 ماهه
  6: 0.12,  // 12% برای 6 ماهه
};

const BULK_DISCOUNTS = [
  { min: 10, percent: 5, label: "۱۰+ عدد: ۵٪" },
  { min: 50, percent: 12, label: "۵۰+ عدد: ۱۲٪" },
];

// ========================================
// InstallmentBanner Component
// ========================================
export default function InstallmentBanner() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(15000000);
  const [months, setMonths] = useState<Months>(4);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // محاسبه مبلغ کل قابل پرداخت
  const profitRate = PROFIT_RATES[months];
  const totalPayable = Math.round(amount * (1 + profitRate));
  const profitAmount = totalPayable - amount;

  // ========================================
  // Handle Submit
  // ========================================
  async function handleSubmit() {
    setSubmitting(true);

    try {
      // TODO: در آینده به API متصل شود
      // await installmentApi.submitRequest({ amount, months });

      // موقتاً شبیه‌سازی
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setSubmitted(true);
      toast.success("درخواست شما با موفقیت ثبت شد");
    } catch (error) {
      toast.error("خطا در ثبت درخواست");
    } finally {
      setSubmitting(false);
    }
  }

  // ========================================
  // Handle Close Modal
  // ========================================
  function handleCloseModal() {
    setOpen(false);
    // Reset state بعد از بستن
    setTimeout(() => {
      setSubmitted(false);
    }, 300);
  }

  return (
    <>
      {/* ======================================== */}
      {/* Main Banner Section */}
      {/* ======================================== */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 md:grid-cols-2">
          {/* ======================================== */}
          {/* Installment Card */}
          {/* ======================================== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col justify-between rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/50 p-6 shadow-md dark:border-emerald-900/40 dark:from-[#08392a] dark:to-[#052e22]"
          >
            <div>
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-[#0F8A5F] dark:bg-emerald-900 dark:text-lime-300">
                <Calendar size={13} /> ویژه فصل زراعی جدید
              </span>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white md:text-xl">
                خرید اقساطی؛ پرداخت پس از برداشت محصول
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-emerald-200">
                در کشت‌یار می‌توانید کود، سم و ادوات مورد نیاز خود را اکنون با چک صیادی دریافت کرده و هزینه آن را ۴ تا ۶ ماه بعد، پس از برداشت محصول پرداخت کنید.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-emerald-900/40">
              <span className="text-xs font-bold text-[#0F8A5F] dark:text-lime-300">
                بدون نیاز به ضامن · کارمزد منصفانه
              </span>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setOpen(true)}
                className="rounded-xl bg-[#0F8A5F] px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-[#064E3B]"
                aria-label="باز کردن شبیه‌ساز خرید اقساطی"
              >
                محاسبه اقساط و استعلام
              </motion.button>
            </div>
          </motion.div>

          {/* ======================================== */}
          {/* B2B Bulk Discount Card */}
          {/* ======================================== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col justify-between rounded-3xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/40 p-6 shadow-md dark:border-amber-900/30 dark:from-[#08392a] dark:to-[#1a2e15]"
          >
            <div>
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                <Percent size={13} /> خرید عمده B2B
              </span>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white md:text-xl">
                تخفیف پلکانی تا ۱۵٪ برای کشت‌وصنعت‌ها و همکاران
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-emerald-200">
                برای خرید بالای ۲۰ واحد از هر کالا یا سفارش‌های کانتینری، تخفیف پلکانی به‌صورت خودکار اعمال می‌شود. امکان صدور فاکتور رسمی مالیاتی.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-emerald-900/40">
              <div className="flex gap-2 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                {BULK_DISCOUNTS.map((discount) => (
                  <span
                    key={discount.min}
                    className="rounded-lg bg-amber-100/60 px-2 py-1 dark:bg-amber-950"
                  >
                    {discount.label}
                  </span>
                ))}
              </div>
              <a
                href="#contact"
                className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:underline dark:text-amber-300"
                aria-label="تماس با واحد فروش عمده"
              >
                <Handshake size={14} /> تماس با واحد فروش عمده
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ======================================== */}
      {/* Installment Calculator Modal */}
      {/* ======================================== */}
      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 z-[85] bg-slate-900/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Modal Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="fixed inset-x-4 top-1/2 z-[90] mx-auto max-w-lg -translate-y-1/2 rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#08392a] md:p-8"
              role="dialog"
              aria-modal="true"
              aria-label="شبیه‌ساز خرید اقساطی"
            >
              {/* Modal Header */}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-slate-800 dark:text-white">
                  شبیه‌ساز خرید اقساطی کشاورزی
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-emerald-950 dark:text-emerald-300"
                  aria-label="بستن"
                >
                  <X size={16} />
                </button>
              </div>

              {/* ======================================== */}
              {/* Modal Content */}
              {/* ======================================== */}
              {!submitted ? (
                <div className="space-y-5">
                  {/* Amount Slider */}
                  <div>
                    <div className="mb-1.5 flex justify-between text-xs font-bold text-slate-700 dark:text-emerald-100">
                      <span>مبلغ تقریبی خرید نهاده‌ها:</span>
                      <span className="text-sm text-[#0F8A5F] dark:text-lime-300">
                        {formatPrice(amount)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5000000}
                      max={100000000}
                      step={5000000}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-emerald-100 accent-[#0F8A5F] dark:bg-emerald-900"
                      aria-label="مبلغ خرید"
                      aria-valuemin={5000000}
                      aria-valuemax={100000000}
                      aria-valuenow={amount}
                    />
                  </div>

                  {/* Months Selection */}
                  <div>
                    <label className="mb-2 block text-xs font-bold text-slate-700 dark:text-emerald-100">
                      مدت بازپرداخت (موعد چک صیادی):
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setMonths(4)}
                        className={`rounded-xl border p-3 text-center text-xs font-bold transition-all ${
                          months === 4
                            ? "border-[#0F8A5F] bg-emerald-50 text-[#0F8A5F] dark:bg-emerald-900 dark:text-white"
                            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        }`}
                        aria-pressed={months === 4}
                      >
                        ۴ ماهه (پرداخت تابستان)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMonths(6)}
                        className={`rounded-xl border p-3 text-center text-xs font-bold transition-all ${
                          months === 6
                            ? "border-[#0F8A5F] bg-emerald-50 text-[#0F8A5F] dark:bg-emerald-900 dark:text-white"
                            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        }`}
                        aria-pressed={months === 6}
                      >
                        ۶ ماهه (پرداخت پاییز)
                      </button>
                    </div>
                  </div>

                  {/* Calculation Summary */}
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-emerald-950/60">
                    <div className="mb-2 flex justify-between text-xs text-slate-500 dark:text-emerald-200">
                      <span>مبلغ اصل فاکتور:</span>
                      <span>{formatPrice(amount)}</span>
                    </div>
                    <div className="mb-2 flex justify-between text-xs text-slate-500 dark:text-emerald-200">
                      <span>
                        کارمزد تعهدی زراعی ({months === 4 ? "۸٪" : "۱۲٪"}):
                      </span>
                      <span>{formatPrice(profitAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-800 dark:border-emerald-800 dark:text-white">
                      <span>مبلغ چک صیادی موقع برداشت:</span>
                      <span className="text-[#0F8A5F] dark:text-lime-300">
                        {formatPrice(totalPayable)}
                      </span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient py-3.5 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                    aria-busy={submitting}
                  >
                    {submitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        در حال ثبت درخواست...
                      </>
                    ) : (
                      <>
                        <Calculator size={16} />
                        ثبت درخواست استعلام اعتبار صیادی
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* ======================================== */
                /* Success State                            */
                /* ======================================== */
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-6 text-center"
                >
                  <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-500" />
                  <h4 className="text-base font-bold text-slate-800 dark:text-white">
                    درخواست شما با موفقیت ثبت شد
                  </h4>
                  <p className="mt-2 text-xs text-slate-500 dark:text-emerald-200">
                    کارشناسان امور مالی کشت‌یار جهت اعتبارسنجی چک صیادی و هماهنگی ارسال کالا تا ۲ ساعت آینده با شما تماس خواهند گرفت.
                  </p>
                  <button
                    onClick={handleCloseModal}
                    className="mt-6 rounded-xl bg-[#0F8A5F] px-6 py-2.5 text-xs font-bold text-white shadow transition-colors hover:bg-[#064E3B]"
                  >
                    متوجه شدم، بازگشت به سایت
                  </button>
                </motion.div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}