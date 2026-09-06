// frontend/src/api/errors.ts
//
// One place that understands the backend's error envelope:
//
//   { error, code, status, fields?: { field: string[] }, retry_after? }
//
// Everything in the app reads errors through `parseApiError`, so a form can
// show a message next to the offending input and a toast never has to guess.

import type { AxiosError } from 'axios';

import { localiseError } from './errorMessages';

export type ApiErrorCode =
  | 'validation_error'
  | 'authentication_required'
  | 'permission_denied'
  | 'not_found'
  | 'method_not_allowed'
  | 'conflict'
  | 'payload_too_large'
  | 'throttled'
  | 'shop_overloaded'
  /** A staff member tried to stand in the customer queue of a desk they staff. */
  | 'staff_not_a_desk_customer'
  | 'server_error'
  | 'service_unavailable'
  | 'network_error'
  | 'timeout'
  | 'error';

export interface ApiErrorEnvelope {
  error: string;
  code: ApiErrorCode;
  status: number;
  fields?: Record<string, string[]>;
  retry_after?: number;
}

/** Field-level errors keyed by field name, holding one message each. */
export type FieldErrors = Record<string, string>;

export interface ParsedApiError {
  message: string;
  code: ApiErrorCode;
  status: number;
  fields: FieldErrors;
  retryAfter?: number;
  /** True when the interceptor has already shown a toast for this error. */
  handled: boolean;
}

// Fallback copy for the cases the server never gets to answer.
const TRANSPORT_MESSAGES = {
  timeout: 'زمان اتصال به سرور به پایان رسید. لطفاً اینترنت خود را بررسی کنید.',
  network: 'اتصال به سرور برقرار نشد. لطفاً اتصال اینترنت خود را بررسی کنید.',
  unknown: 'خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.',
} as const;

function flattenFields(fields?: Record<string, string[] | string>): FieldErrors {
  if (!fields) return {};
  return Object.entries(fields).reduce<FieldErrors>((accumulator, [key, value]) => {
    const message = Array.isArray(value) ? value[0] : value;
    if (message) accumulator[key] = String(message);
    return accumulator;
  }, {});
}

/**
 * Normalise anything thrown by axios into a predictable shape.
 * Legacy payloads (`{detail: ...}`, DRF's raw `{field: [...]}`) are still
 * understood so a single un-migrated endpoint cannot crash a form.
 */
export function parseApiError(error: unknown): ParsedApiError {
  const axiosError = error as AxiosError<Partial<ApiErrorEnvelope> & Record<string, unknown>>;

  if (axiosError?.code === 'ECONNABORTED') {
    return {
      message: localiseError('timeout', TRANSPORT_MESSAGES.timeout),
      code: 'timeout',
      status: 0,
      fields: {},
      handled: Boolean((axiosError as { __handled?: boolean }).__handled),
    };
  }

  if (!axiosError?.response) {
    return {
      message: localiseError('network_error', TRANSPORT_MESSAGES.network),
      code: 'network_error',
      status: 0,
      fields: {},
      handled: Boolean((axiosError as { __handled?: boolean }).__handled),
    };
  }

  const { status, data } = axiosError.response;
  const handled = Boolean((axiosError as { __handled?: boolean }).__handled);

  if (data && typeof data === 'object') {
    const envelope = data as Partial<ApiErrorEnvelope>;

    if (typeof envelope.error === 'string') {
      const code = (envelope.code as ApiErrorCode) ?? 'error';
      return {
        // In Persian the server's own wording is kept (it is more specific);
        // in another language the code is translated instead.
        message: localiseError(code, envelope.error),
        code,
        status: envelope.status ?? status,
        fields: flattenFields(envelope.fields),
        retryAfter: envelope.retry_after,
        handled,
      };
    }

    // Legacy shapes: {detail: "..."} or DRF's bare {field: ["..."]}.
    const detail = (data as { detail?: string }).detail;
    const legacyFields = flattenFields(
      data as unknown as Record<string, string[] | string>,
    );
    delete legacyFields.detail;

    const firstFieldMessage = Object.values(legacyFields)[0];
    const legacyCode: ApiErrorCode = status === 400 ? 'validation_error' : 'error';
    return {
      message: localiseError(legacyCode, detail ?? firstFieldMessage ?? TRANSPORT_MESSAGES.unknown),
      code: legacyCode,
      status,
      fields: legacyFields,
      handled,
    };
  }

  return {
    message: localiseError('error', TRANSPORT_MESSAGES.unknown),
    code: 'error',
    status,
    fields: {},
    handled,
  };
}

/** Convenience for forms: the field map, or an empty object. */
export function fieldErrorsFrom(error: unknown): FieldErrors {
  return parseApiError(error).fields;
}
