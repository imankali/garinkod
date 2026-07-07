// frontend/src/utils/formatPrice.ts

/**
 * تابع فرمت کردن قیمت به فرمت فارسی با واحد تومان
 *
 * این تابع در سراسر پروژه برای نمایش قیمت محصولات استفاده می‌شود.
 * از toLocaleString با locale "fa-IR" استفاده می‌کند تا اعداد به صورت فارسی نمایش داده شوند.
 *
 * @param price - قیمت به صورت عدد (مثلاً 385000)
 * @returns رشته فرمت شده (مثلاً "۳۸۵٬۰۰ تومان")
 *
 * @example
 * formatPrice(385000) // "۳۸۵٬۰۰ تومان"
 * formatPrice(0) // "۰ تومان"
 * formatPrice(1250000) // "۱٬۲۵٬۰۰۰ تومان"
 */
export function formatPrice(price: number): string {
  return price.toLocaleString("fa-IR") + " تومان";
}

/**
 * تابع فرمت کردن قیمت بدون واحد تومان (فقط عدد)
 * برای استفاده در جاهایی که فقط عدد نیاز است
 *
 * @param price - قیمت به صورت عدد
 * @returns رشته فرمت شده بدون واحد (مثلاً "۸۵٬۰۰")
 *
 * @example
 * formatPriceOnly(385000) // "۳۸۵٬۰۰"
 */
export function formatPriceOnly(price: number): string {
  return price.toLocaleString("fa-IR");
}

/**
 * تابع محاسبه درصد تخفیف
 *
 * @param originalPrice - قیمت اصلی
 * @param discountedPrice - قیمت با تخفیف
 * @returns درصد تخفیف به صورت عدد (مثلاً 15 برای 15%)
 *
 * @example
 * calculateDiscount(100000, 85000) // 15
 * calculateDiscount(100000, 100000) // 0
 */
export function calculateDiscount(originalPrice: number, discountedPrice: number): number {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}