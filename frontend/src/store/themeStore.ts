// frontend/src/store/themeStore.ts
//
// One shared theme state so the header toggle and the profile's site-settings
// section can never disagree. The preference is persisted under the same key
// the previous hook used.

import { create } from 'zustand';

const STORAGE_KEY = 'theme-preference';

function getSystemPreference(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

function getInitialDark(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
  } catch {
    // Fall through to the system preference.
  }
  return getSystemPreference();
}

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  setDark: (value: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: getInitialDark(),

  toggle: () =>
    set((state) => {
      const next = !state.isDark;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      } catch {
        // Storage can be unavailable in private mode.
      }
      return { isDark: next };
    }),

  setDark: (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'dark' : 'light');
    } catch {
      // See above.
    }
    set({ isDark: value });
  },
}));

/** Apply the theme class to the <html> element (used once, in App). */
export function applyThemeClass(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) root.classList.add('dark');
  else root.classList.remove('dark');
}
