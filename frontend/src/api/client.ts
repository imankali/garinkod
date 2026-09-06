// frontend/src/api/client.ts

import axios, { AxiosError, AxiosInstance } from 'axios';
import toast from 'react-hot-toast';

import { markWaiting } from './admission';
import { parseApiError } from './errors';
import { readPreviewToken } from './previewSession';

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

/**
 * Let the browser set the Content-Type for FormData bodies.
 *
 * The instance-level `application/json` default was being applied to multipart
 * uploads too, so the browser never added the `boundary=…` parameter and
 * Django tried to JSON-parse the binary body — which is why saving a storefront
 * cover (or any other file) silently failed with a parse error. Deleting the
 * header here makes axios fall back to the correct multipart value.
 */
apiClient.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  // Only ever set in a preview whose browser refuses cookies (see previewSession.ts);
  // on the real shop there is no token here, so requests stay cookie-only.
  const previewToken = readPreviewToken();
  if (previewToken) {
    config.headers.Authorization = `Token ${previewToken}`;
  }
  return config;
});

// Browser authentication is cookie-based. The HttpOnly token is never exposed
// to JavaScript; service integrations can still use Authorization headers, and the
// preview fallback above is the only place where the browser itself uses one.

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
  '/auth/otp/request/',
  '/auth/otp/verify/',
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
    } else if (parsed.code === 'shop_overloaded') {
      // The shop is holding its own door because it is busy, which is not an
      // error to shout about: the waiting screen says it better, in full
      // sentences, with the place in line. Silence the toast either way.
      const queue = (error.response?.data as { queue?: unknown } | undefined)?.queue;
      markWaiting(queue);
      (error as { __handled?: boolean }).__handled = true;
    } else if (parsed.code === 'throttled') {
      const now = Date.now();
      if (!silent && now - lastThrottleToastAt > 3000) {
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
