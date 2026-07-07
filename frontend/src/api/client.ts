// frontend/src/api/client.ts

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

// ✅ استفاده از URL نسبی (Vite Proxy این را به Django می‌فرستد)
// این کار باعث می‌شود هم در localhost و هم در شبکه داخلی (گوشی) بدون مشکل کار کند.
const API_BASE_URL = '/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15 ثانیه timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// ========================================
// Request Interceptor - اضافه کردن Token
// ========================================
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ========================================
// Response Interceptor - مدیریت خطاها
// ========================================
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // بررسی خطای 401 (Unauthorized)
    if (error.response?.status === 401) {
      // اگر خطای 401 از لاگین یا ثبت‌نام نبود، توکن را پاک کن
      const url = error.config?.url || '';
      if (!url.includes('/auth/login/') && !url.includes('/auth/register/')) {
        localStorage.removeItem('auth_token');
        toast.error('لطفاً دوباره وارد شوید');
        // ریدایرکت به لاگین (اگر در صفحه لاگین نیستیم)
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
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