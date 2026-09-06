import { create } from 'zustand';
import toast from 'react-hot-toast';

import { authApi, avatarApi } from '../api/services';
import { parseApiError } from '../api/errors';
import {
  USER_LEVEL,
  type OtpRequestResponse,
  type User,
  type UserAccount,
  type UserLevel,
} from '../types';

interface AuthState {
  user: User | null;
  account: UserAccount | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSessionChecked: boolean;
  initializeSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  requestOtp: (phone: string, channel?: 'auto' | 'sms' | 'bale') => Promise<OtpRequestResponse>;
  verifyOtp: (data: {
    request_id: string;
    phone: string;
    code: string;
    first_name?: string;
    last_name?: string;
  }) => Promise<void>;
  register: (data: {
    username: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    password: string;
    password2: string;
    phone?: string;
    gender?: 'male' | 'female';
    address?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    gender: 'male' | 'female';
    address: string;
  }>) => Promise<void>;
  clearAuth: () => void;
  uploadAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
  /**
   * True when the server accepted the credentials but the browser will not keep
   * the session cookie. The login forms then show what to do about it instead of
   * letting the visitor spin.
   */
  cookieBlocked: boolean;
  recheckCookieJar: () => Promise<boolean>;
  dismissCookieNotice: () => void;
}

const signedOutState = {
  user: null,
  account: null,
  isAuthenticated: false,
};

/**
 * Does the browser actually keep what the shop just gave it?
 *
 * A cookie-less follow-up makes a correct password look broken: the server says
 * «welcome», the next request is a stranger, and the visitor is back at the door.
 * It happens when the site is opened inside an iframe of another origin (the usual
 * sandbox preview), with third-party cookies blocked, and in some private-browsing
 * modes. One cheap probe after each sign-in turns that loop into a sentence.
 */
async function sessionSurvivesTheBrowser(): Promise<boolean> {
  try {
    const response = await authApi.session();
    return Boolean(response.data?.user);
  } catch {
    return false;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...signedOutState,
  isLoading: false,
  isSessionChecked: false,
  cookieBlocked: false,

  initializeSession: async () => {
    // Every page load is a fresh chance: the visitor may have opened the site in
    // its own tab or allowed cookies since the last attempt.
    set({ isLoading: true, cookieBlocked: false });
    try {
      const response = await authApi.session();
      set({
        user: response.data.user,
        account: response.data.account,
        isAuthenticated: true,
        isLoading: false,
        isSessionChecked: true,
      });
    } catch {
      set({ ...signedOutState, isLoading: false, isSessionChecked: true });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login(username, password);
      if (!(await sessionSurvivesTheBrowser())) {
        set({ ...signedOutState, cookieBlocked: true, isLoading: false, isSessionChecked: true });
        toast.error('رمز درست بود، اما مرورگر کوکی نشست را نگه نداشت.');
        return;
      }
      set({ user: response.data.user, account: response.data.account, isAuthenticated: true, isLoading: false, isSessionChecked: true, cookieBlocked: false });
      toast.success('ورود با موفقیت انجام شد');
    } catch (error) {
      const parsed = parseApiError(error);
      // The login endpoint is silent in the interceptor, so the message is
      // surfaced exactly once here.
      if (!parsed.handled) toast.error(parsed.message);
      set({ isLoading: false, isSessionChecked: true });
      throw error;
    }
  },

  requestOtp: async (phone, channel = 'auto') => {
    set({ isLoading: true });
    try {
      const response = await authApi.requestOtp(phone, channel);
      set({ isLoading: false });
      toast.success('کد تأیید ارسال شد');
      return response.data;
    } catch (error) {
      // The OTP form renders provider, validation and cooldown errors inline.
      set({ isLoading: false });
      throw error;
    }
  },

  verifyOtp: async (data) => {
    set({ isLoading: true });
    try {
      const response = await authApi.verifyOtp(data);
      const kept = await sessionSurvivesTheBrowser();
      if (!kept) {
        set({ ...signedOutState, cookieBlocked: true, isLoading: false, isSessionChecked: true });
        toast.error('کد درست بود، اما مرورگر کوکی نشست را نگه نداشت.');
        return;
      }
      set({
        user: response.data.user,
        account: response.data.account,
        isAuthenticated: true,
        isLoading: false,
        isSessionChecked: true,
        cookieBlocked: false,
      });
      toast.success(response.data.created ? 'حساب شما ساخته شد؛ خوش آمدید' : 'ورود با موفقیت انجام شد');
    } catch (error) {
      set({ isLoading: false, isSessionChecked: true });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const response = await authApi.register(data);
      if (!(await sessionSurvivesTheBrowser())) {
        set({ ...signedOutState, cookieBlocked: true, isLoading: false, isSessionChecked: true });
        toast.error('حساب ساخته شد، اما مرورگر کوکی نشست را نگه نداشت.');
        return;
      }
      set({ user: response.data.user, account: response.data.account, isAuthenticated: true, isLoading: false, isSessionChecked: true, cookieBlocked: false });
      toast.success('ثبت‌نام با موفقیت انجام شد');
    } catch (error) {
      const parsed = parseApiError(error);
      // Field errors are rendered by the register form itself; only a
      // form-wide problem needs a toast.
      if (!parsed.handled && Object.keys(parsed.fields).length === 0) {
        toast.error(parsed.message);
      }
      set({ isLoading: false, isSessionChecked: true });
      throw error;
    }
  },

  recheckCookieJar: async () => {
    const kept = await sessionSurvivesTheBrowser();
    set({ cookieBlocked: !kept });
    if (kept) await get().initializeSession();
    return kept;
  },

  dismissCookieNotice: () => set({ cookieBlocked: false }),

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear local state even if the server-side session already expired.
    } finally {
      set({ ...signedOutState, isSessionChecked: true, cookieBlocked: false });
      toast.success('خروج با موفقیت انجام شد');
    }
  },

  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const response = await authApi.getProfile();
      set({ user: response.data.user, account: response.data.account, isAuthenticated: true, isLoading: false, isSessionChecked: true });
    } catch {
      set({ ...signedOutState, isLoading: false, isSessionChecked: true });
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true });
    try {
      const response = await authApi.updateProfile(data);
      set({ user: response.data.user, account: response.data.account, isAuthenticated: true, isLoading: false, isSessionChecked: true });
      toast.success('پروفایل با موفقیت بروزرسانی شد');
    } catch (error) {
      const parsed = parseApiError(error);
      if (!parsed.handled && Object.keys(parsed.fields).length === 0) {
        toast.error(parsed.message);
      }
      set({ isLoading: false, isSessionChecked: true });
      throw error;
    }
  },

  uploadAvatar: async (file: File) => {
    set({ isLoading: true });
    try {
      const response = await avatarApi.upload(file);
      set({ account: response.data, isLoading: false });
      toast.success('تصویر پروفایل به‌روزرسانی شد');
    } catch (error) {
      const parsed = parseApiError(error);
      if (!parsed.handled) toast.error(parsed.fields.avatar ?? parsed.message);
      set({ isLoading: false });
      throw error;
    }
  },

  removeAvatar: async () => {
    set({ isLoading: true });
    try {
      const response = await avatarApi.remove();
      set({ account: response.data, isLoading: false });
      toast.success('تصویر پروفایل حذف شد');
    } catch (error) {
      const parsed = parseApiError(error);
      if (!parsed.handled) toast.error(parsed.message);
      set({ isLoading: false });
      throw error;
    }
  },

  clearAuth: () => set({ ...signedOutState, isSessionChecked: true }),
}));

/**
 * The caller's access level.
 *
 * A signed-in user whose profile has not loaded yet is treated as level 1
 * rather than level 0, so the UI never flashes "no access" for an ordinary
 * buyer mid-fetch.
 */
export function useUserLevel(): UserLevel | 0 {
  const { isAuthenticated, account } = useAuthStore();
  if (!isAuthenticated) return 0;
  return account?.level ?? USER_LEVEL.BUYER;
}

export function useHasLevel(required: UserLevel): boolean {
  return useUserLevel() >= required;
}
