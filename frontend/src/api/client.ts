// frontend/src/api/client.ts

import axios, { AxiosError, AxiosInstance } from 'axios';
import toast from 'react-hot-toast';

// ✅ استفاده از URL نسبی (Vite Proxy این را به Django می‌فرستد)
// این کار باعث می‌شود هم در localhost و هم در شبکه داخلی (گوشی) بدون مشکل کار کند.
const API_BASE_URL = '/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15 ثانیه timeout
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Browser authentication is cookie-based. The HttpOnly token is never exposed
// to JavaScript; service integrations can still use Authorization headers.

// ========================================
// Response Interceptor - مدیریت خطاها
// ========================================
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // بررسی خطای 401 (Unauthorized)
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Session probing is expected to return 401 for visitors and must not
      // interrupt the public catalogue by redirecting to login.
      if (!url.includes('/auth/login/') && !url.includes('/auth/register/') && !url.includes('/auth/session/')) {
        toast.error('لطفاً دوباره وارد شوید');
        if (window.location.pathname !== '/login') window.location.href = '/login';
      }
    }
    // بررسی خطای Timeout
    else if (error.code === 'ECONNABORTED') {
      toast.error('زمان اتصال به سرور به پایان رسید. لطفاً اینترنت خود را بررسی کنید.');
    }
    // بررسی خطای Network (سرور خاموش است یا اینترنت قطع است)
    else if (!error.response) {
      toast.error('اتصال به سرور برقرار نشد. لطفاً از روشن بودن سرور مطمئن شوید.');
    }
    // سایر خطاها (400, 403, 404, 500, ...)
    else {
      // اگر بک‌اند پیام خطای فارسی فرستاده باشد، آن را نمایش بده
      const errorMessage = (error.response.data as any)?.error ||
                           (error.response.data as any)?.detail ||
                           'خطایی رخ داد';
      toast.error(errorMessage);
    }

    return Promise.reject(error);
  }
);

export default apiClient;