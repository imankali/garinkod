// frontend/src/utils/cn.ts

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * تابع کمکی برای ترکیب کلاس‌های Tailwind CSS
 * 
 * این تابع دو کار مهم انجام می‌دهد:
 * 1. clsx: کلاس‌های شرطی و آرایه‌ای را به یک رشته تبدیل می‌کند
 * 2. twMerge: کلاس‌های متناقض Tailwind را به درستی مدیریت می‌کند 
 *    (مثلاً اگر هم bg-red-500 و هم bg-blue-500 داده شود، دومی را اعمال می‌کند)
 * 
 * @example
 * cn("px-4 py-2", isActive && "bg-blue-500", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}