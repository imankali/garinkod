// frontend/src/store/authStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/services';
import type { User, UserAccount } from '../types';
import toast from 'react-hot-toast';

// ========================================
// Auth State Interface
// ========================================
interface AuthState {
  // State
  user: User | null;
  account: UserAccount | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
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

// ========================================
// Auth Store
// ========================================
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      account: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      // ========================================
      // Login Action
      // ========================================
      login: async (username: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await authApi.login(username, password);
          const { user, token } = response.data;

          // ذخیره توکن در localStorage
          localStorage.setItem('auth_token', token);

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });

          toast.success('ورود با موفقیت انجام شد');
        } catch (error: any) {
          console.error('Login failed:', error);
          const errorMsg = error.response?.data?.error || 'نام کاربری یا رمز عبور اشتباه است';
          toast.error(errorMsg);
          set({ isLoading: false });
          throw error;
        }
      },

      // ========================================
      // Register Action
      // ========================================
      register: async (data) => {
        set({ isLoading: true });
        try {
          const response = await authApi.register(data);
          const { user, token } = response.data;

          // ذخیره توکن در localStorage
          localStorage.setItem('auth_token', token);

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });

          toast.success('ثبت‌نام با موفقیت انجام شد');
        } catch (error: any) {
          console.error('Registration failed:', error);

          // نمایش خطاهای validation
          const errors = error.response?.data;
          if (errors && typeof errors === 'object') {
            const firstError = Object.values(errors)[0];
            const errorMsg = Array.isArray(firstError) ? firstError[0] : String(firstError);
            toast.error(errorMsg);
          } else {
            toast.error('خطا در ثبت‌نام');
          }

          set({ isLoading: false });
          throw error;
        }
      },

      // ========================================
      // Logout Action
      // ========================================
      logout: async () => {
        try {
          await authApi.logout();
        } catch (error) {
          console.error('Logout failed:', error);
          // حتی اگر API خطا داد، کاربر را logout کن
        } finally {
          localStorage.removeItem('auth_token');
          set({
            user: null,
            account: null,
            token: null,
            isAuthenticated: false,
          });
          toast.success('خروج با موفقیت انجام شد');
        }
      },

      // ========================================
      // Fetch Profile Action
      // ========================================
      fetchProfile: async () => {
        set({ isLoading: true });
        try {
          const response = await authApi.getProfile();
          set({
            user: response.data.user,
            account: response.data.account,
            isLoading: false,
          });
        } catch (error) {
          console.error('Failed to fetch profile:', error);
          set({ isLoading: false });
        }
      },

      // ========================================
      // Update Profile Action
      // ========================================
      updateProfile: async (data) => {
        set({ isLoading: true });
        try {
          const response = await authApi.updateProfile(data);
          set({
            user: response.data.user,
            account: response.data.account,
            isLoading: false,
          });
          toast.success('پروفایل با موفقیت بروزرسانی شد');
        } catch (error: any) {
          console.error('Failed to update profile:', error);
          const errorMsg = error.response?.data?.error || 'خطا در بروزرسانی پروفایل';
          toast.error(errorMsg);
          set({ isLoading: false });
          throw error;
        }
      },

      // ========================================
      // Clear Auth Action (برای پاک کردن کامل state)
      // ========================================
      clearAuth: () => {
        localStorage.removeItem('auth_token');
        set({
          user: null,
          account: null,
          token: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);