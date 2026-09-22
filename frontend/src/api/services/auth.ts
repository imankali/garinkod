// frontend/src/api/services/auth.ts
// Authentication and account endpoints.
//
// Keeping one bounded API surface per domain prevents the client layer
// from becoming a second monolith as new capabilities are added.

import apiClient from '../client';
import type {
  AuthResponse,
  LevelsSnapshot,
  OtpRequestResponse,
  ProfileResponse,
  RegisterPayload,
  UserAccount,
} from '@/types/user';

export const authApi = {
  /**
   * ورود کاربر
   * POST /api/auth/login/
   */
  login: (username: string, password: string) => {
    return apiClient.post<AuthResponse>('/auth/login/', {
      username,
      password,
    });
  },

  /**
   * ثبت‌نام کاربر
   * POST /api/auth/register/
   */
  register: (data: RegisterPayload) => {
    return apiClient.post<AuthResponse>('/auth/register/', data);
  },

  /** Request a provider-delivered login code without exposing account existence. */
  requestOtp: (phone: string, channel: 'auto' | 'sms' | 'bale' = 'auto') =>
    apiClient.post<OtpRequestResponse>('/auth/otp/request/', { phone, channel }),

  /** Verify a challenge; Django returns the regular HttpOnly auth cookie. */
  verifyOtp: (data: {
    request_id: string;
    phone: string;
    code: string;
    first_name?: string;
    last_name?: string;
  }) => apiClient.post<AuthResponse>('/auth/otp/verify/', data),

  /**
   * خروج کاربر
   * POST /api/auth/logout/
   */
  logout: () => {
    return apiClient.post<{ message: string }>('/auth/logout/');
  },

  session: () => apiClient.get<ProfileResponse>('/auth/session/'),

  /**
   * دریافت پروفایل کاربر
   * GET /api/profile/
   */
  getProfile: () => {
    return apiClient.get<ProfileResponse>('/profile/');
  },

  /**
   * به‌روزرسانی پروفایل کاربر
   * PUT/PATCH /api/profile/
   */
  updateProfile: (data: Partial<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    gender: 'male' | 'female';
    address: string;
  }>) => {
    return apiClient.patch<ProfileResponse>('/profile/', data);
  },
};

export const levelsApi = {
  snapshot: () => apiClient.get<LevelsSnapshot>('/levels/'),
};

export const avatarApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiClient.post<UserAccount>('/profile/avatar/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  remove: () => apiClient.delete<UserAccount>('/profile/avatar/'),
};
