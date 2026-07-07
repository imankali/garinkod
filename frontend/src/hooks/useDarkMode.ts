// frontend/src/hooks/useDarkMode.ts

import { useEffect, useState } from "react";

// ========================================
// Types
// ========================================
interface UseDarkModeReturn {
  isDark: boolean;
  toggle: () => void;
  setDark: (value: boolean) => void;
}

// ========================================
// Constants
// ========================================
const STORAGE_KEY = "theme-preference";

// ========================================
// Helper: تشخیص تم پیش‌فرض سیستم
// ========================================
function getSystemPreference(): boolean {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

// ========================================
// Helper: بارگذاری تم از localStorage
// ========================================
function getStoredPreference(): boolean | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return null;
  } catch {
    return null;
  }
}

// ========================================
// useDarkMode Hook
// ========================================
export function useDarkMode(): UseDarkModeReturn {
  // ========================================
  // State: مقدار اولیه از localStorage یا سیستم
  // ========================================
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = getStoredPreference();
    if (stored !== null) return stored;
    return getSystemPreference();
  });

  // ========================================
  // Effect: اعمال کلاس dark روی html element
  // ========================================
  useEffect(() => {
    const root = document.documentElement;

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // ذخیره در localStorage
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  }, [isDark]);

  // ========================================
  // Effect: گوش دادن به تغییر تم سیستم
  // ========================================
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      // فقط اگر کاربر تم را دستی تغییر نداده باشد
      const stored = getStoredPreference();
      if (stored === null) {
        setIsDark(e.matches);
      }
    };

    // اضافه کردن listener (پشتیبانی از هر دو API قدیم و جدید)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      // Fallback برای مرورگرهای قدیمی
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        // Fallback برای مرورگرهای قدیمی
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // ========================================
  // Actions
  // ========================================
  const toggle = () => setIsDark((prev) => !prev);

  const setDark = (value: boolean) => setIsDark(value);

  // ========================================
  // Return
  // ========================================
  return {
    isDark,
    toggle,
    setDark,
  };
}