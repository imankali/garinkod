// frontend/src/api/errorMessages.ts
//
// Localised copy for API errors.
//
// The server always answers in Persian, but it also returns a stable machine
// `code` with every failure. That code — not the prose — is what gets
// translated here, so switching the interface language also switches the error
// text without the backend needing to negotiate a locale.
//
// Field-level messages (`fields`) are intentionally NOT translated: they are
// specific ("minimum order is 50 kg"), often contain server-side data, and a
// generic translation would lose that detail. They are shown as the server
// wrote them.

import type { ApiErrorCode } from './errors';
import type { Locale } from '../i18n';

type CodeMessages = Record<ApiErrorCode, string>;

const MESSAGES: Record<Locale, CodeMessages> = {
  fa: {
    validation_error: 'اطلاعات ارسال‌شده معتبر نیست. لطفاً موارد مشخص‌شده را اصلاح کنید.',
    authentication_required: 'برای انجام این کار باید وارد حساب کاربری خود شوید.',
    permission_denied: 'شما اجازه دسترسی به این بخش را ندارید.',
    not_found: 'موردی که دنبال آن بودید پیدا نشد.',
    method_not_allowed: 'این عملیات روی این آدرس پشتیبانی نمی‌شود.',
    conflict: 'به دلیل تغییر وضعیت، این درخواست قابل انجام نیست.',
    payload_too_large: 'حجم فایل ارسالی بیش از حد مجاز است.',
    throttled: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً کمی صبر کنید.',
    server_error: 'خطای غیرمنتظره‌ای رخ داد. تیم فنی در جریان قرار گرفت.',
    service_unavailable: 'سرویس ارسال پیام موقتاً در دسترس نیست. کمی بعد تلاش کنید.',
    network_error: 'اتصال به سرور برقرار نشد. لطفاً اتصال اینترنت خود را بررسی کنید.',
    timeout: 'زمان اتصال به سرور به پایان رسید. لطفاً اینترنت خود را بررسی کنید.',
    error: 'خطایی رخ داد. لطفاً دوباره تلاش کنید.',
  },
  en: {
    validation_error: 'Some of the information is not valid. Please correct the highlighted fields.',
    authentication_required: 'Please sign in to continue.',
    permission_denied: 'You do not have permission to access this section.',
    not_found: 'We could not find what you were looking for.',
    method_not_allowed: 'That action is not supported on this address.',
    conflict: 'This request can no longer be completed because the status changed.',
    payload_too_large: 'The uploaded file is larger than the allowed size.',
    throttled: 'You have made too many requests. Please wait a moment and try again.',
    server_error: 'Something unexpected went wrong. Our team has been notified.',
    service_unavailable: 'The messaging service is temporarily unavailable. Please try again shortly.',
    network_error: 'Could not reach the server. Please check your internet connection.',
    timeout: 'The server took too long to respond. Please check your connection.',
    error: 'Something went wrong. Please try again.',
  },
  ar: {
    validation_error: 'بعض البيانات غير صحيحة. يرجى تصحيح الحقول المحددة.',
    authentication_required: 'يرجى تسجيل الدخول للمتابعة.',
    permission_denied: 'ليس لديك صلاحية الوصول إلى هذا القسم.',
    not_found: 'لم نتمكن من العثور على ما تبحث عنه.',
    method_not_allowed: 'هذه العملية غير مدعومة على هذا العنوان.',
    conflict: 'تعذر إتمام الطلب لأن الحالة تغيّرت.',
    payload_too_large: 'حجم الملف المرسل أكبر من المسموح.',
    throttled: 'لقد أرسلت طلبات كثيرة. يرجى الانتظار قليلاً.',
    server_error: 'حدث خطأ غير متوقع. تم إبلاغ الفريق الفني.',
    service_unavailable: 'خدمة الرسائل غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.',
    network_error: 'تعذر الاتصال بالخادم. يرجى التحقق من الإنترنت.',
    timeout: 'انتهت مهلة الاتصال بالخادم. يرجى التحقق من الإنترنت.',
    error: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
  },
};

/**
 * The active locale, read from the same key the i18n provider persists to.
 * A plain module-level read keeps this usable from the axios interceptor,
 * which lives outside React and therefore cannot call a hook.
 */
export function currentLocale(): Locale {
  if (typeof window === 'undefined') return 'fa';
  const stored = window.localStorage.getItem('garinkood_locale');
  return stored === 'en' || stored === 'ar' ? stored : 'fa';
}

/**
 * Localised message for an error code.
 *
 * When the interface is in Persian the server's own message is preferred: it
 * is more specific than the generic per-code text. In another language the
 * translated text wins, because a Persian sentence would be unreadable.
 */
export function localiseError(code: ApiErrorCode, serverMessage: string): string {
  const locale = currentLocale();
  if (locale === 'fa') return serverMessage || MESSAGES.fa[code] || MESSAGES.fa.error;
  return MESSAGES[locale][code] || MESSAGES[locale].error || serverMessage;
}

export default localiseError;
