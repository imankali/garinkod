// frontend/src/api/client.ts

import axios, { AxiosError, AxiosInstance } from 'axios';
import toast from 'react-hot-toast';

import { parseApiError } from './errors';

// Relative URL: the Vite proxy (dev) and the reverse proxy (production) both
// forward /api to Django, so the same build works on localhost, a phone on the
// LAN and the deployed site without any per-environment configuration.
const API_BASE_URL = '/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Browser authentication is cookie-based. The HttpOnly token is never exposed
// to JavaScript; service integrations can still use Authorization headers.

/**
 * Endpoints whose failures a caller always renders itself.
 *
 * Validation errors belong next to the offending input, and probing the
 * session is *expected* to 401 for a visitor, so the interceptor stays quiet
 * for these and lets the component decide.
 */
const SILENT_PATHS = [
  '/auth/session/',
  '/auth/login/',
  '/auth/register/',
  '/marketplace/storefront/availability/',
  '/agri/calculate/',
];

function isSilent(url: string | undefined): boolean {
  if (!url) return false;
  return SILENT_PATHS.some((path) => url.includes(path));
}

// Rate-limit notices are the one message worth de-duplicating globally: a
// burst of parallel requests would otherwise stack identical toasts.
let lastThrottleToastAt = 0;

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const parsed = parseApiError(error);
    const url = error.config?.url ?? '';
    const silent = isSilent(url);

    if (parsed.status === 401) {
      // A visitor hitting an authenticated endpoint is redirected once; the
      // session probe is excluded so the public catalogue is never disturbed.
      if (!silent) {
        toast.error(parsed.message);
        (error as { __handled?: boolean }).__handled = true;
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    } else if (parsed.code === 'throttled') {
      const now = Date.now();
      if (now - lastThrottleToastAt > 3000) {
        lastThrottleToastAt = now;
        toast.error(parsed.message);
        (error as { __handled?: boolean }).__handled = true;
      }
    } else if (parsed.code === 'validation_error') {
      // Field-level problems are rendered by the form. Only a validation error
      // with no field attached has nowhere else to go.
      if (!silent && Object.keys(parsed.fields).length === 0) {
        toast.error(parsed.message);
        (error as { __handled?: boolean }).__handled = true;
      }
    } else if (!silent) {
      toast.error(parsed.message);
      (error as { __handled?: boolean }).__handled = true;
    }

    return Promise.reject(error);
  },
);

export default apiClient;
