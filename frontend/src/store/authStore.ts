import { create } from 'zustand';
import toast from 'react-hot-toast';

import { authApi, avatarApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { USER_LEVEL, type User, type UserAccount, type UserLevel } from '../types';

interface AuthState {
  user: User | null;
  account: UserAccount | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSessionChecked: boolean;
  initializeSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
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
}

const signedOutState = {
  user: null,
  account: null,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...signedOutState,
  isLoading: false,
  isSessionChecked: false,

  initializeSession: async () => {
    set({ isLoading: true });
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
      set({ user: response.data.user, account: null, isAuthenticated: true, isLoading: false, isSessionChecked: true });
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

  register: async (data) => {
    set({ isLoading: true });
    try {
      const response = await authApi.register(data);
      set({ user: response.data.user, account: null, isAuthenticated: true, isLoading: false, isSessionChecked: true });
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

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear local state even if the server-side session already expired.
    } finally {
      set({ ...signedOutState, isSessionChecked: true });
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
