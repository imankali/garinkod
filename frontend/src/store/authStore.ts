import { create } from 'zustand';
import toast from 'react-hot-toast';

import { authApi } from '../api/services';
import type { User, UserAccount } from '../types';

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
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'نام کاربری یا رمز عبور اشتباه است';
      toast.error(errorMsg);
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
    } catch (error: any) {
      const errors = error.response?.data;
      if (errors && typeof errors === 'object') {
        const firstError = Object.values(errors)[0];
        toast.error(Array.isArray(firstError) ? String(firstError[0]) : String(firstError));
      } else {
        toast.error('خطا در ثبت‌نام');
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
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'خطا در بروزرسانی پروفایل';
      toast.error(errorMsg);
      set({ isLoading: false, isSessionChecked: true });
      throw error;
    }
  },

  clearAuth: () => set({ ...signedOutState, isSessionChecked: true }),
}));
