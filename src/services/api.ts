import { clearStorageKey, readStorageJson, writeStorageJson } from './storage';

function readEnv(key: string): string | undefined {
  try {
    const meta = import.meta as { env?: Record<string, string | undefined> };
    return meta?.env?.[key];
  } catch {
    return undefined;
  }
}

const rawBaseUrl = readEnv('VITE_API_BASE_URL')?.trim();

/**
 * Base URL for the Karur Fresh Mart Node.js + PostgreSQL backend REST API.
 * Configured via `VITE_API_BASE_URL` (defaults to local backend dev server).
 */
export const API_BASE_URL: string =
  rawBaseUrl && rawBaseUrl.length > 0
    ? rawBaseUrl.replace(/\/+$/, '')
    : 'http://localhost:4000/api';

/**
 * Global mock switch controlled by `VITE_USE_MOCK`.
 * - `true` (default): Services use localStorage-backed mock stores so the frontend works standalone.
 * - `false`: Services call the real Node.js + PostgreSQL REST API via `apiClient`.
 */
export const USE_MOCK: boolean = readEnv('VITE_USE_MOCK') !== 'false';

let mockModeOverride: boolean | null = null;

/**
 * Returns whether services should currently execute against local mock stores.
 */
export function isMockMode(): boolean {
  return mockModeOverride ?? USE_MOCK;
}

/**
 * Test/diagnostic override for switching between mock mode (`true`) and REST API mode (`false`).
 * Pass `null` to restore the default `USE_MOCK` env configuration.
 */
export function setMockModeOverride(override: boolean | null): void {
  mockModeOverride = override;
}

const AUTH_TOKEN_STORAGE_KEY = 'kfm_auth_token_v2';
const DEFAULT_TIMEOUT_MS = 15_000;

let inMemoryAuthToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function getAuthToken(): string | null {
  if (inMemoryAuthToken) return inMemoryAuthToken;
  const stored = readStorageJson<string | null>(AUTH_TOKEN_STORAGE_KEY, null);
  if (typeof stored === 'string' && stored.trim().length > 0) {
    inMemoryAuthToken = stored.trim();
    return inMemoryAuthToken;
  }
  return null;
}

export function setAuthToken(token: string | null): void {
  if (!token || !token.trim()) {
    clearAuthToken();
    return;
  }
  const clean = token.trim();
  inMemoryAuthToken = clean;
  writeStorageJson(AUTH_TOKEN_STORAGE_KEY, clean);
}

export function clearAuthToken(): void {
  inMemoryAuthToken = null;
  clearStorageKey(AUTH_TOKEN_STORAGE_KEY);
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  message?: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly endpoint: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(params: {
    message: string;
    status: number;
    code?: string;
    endpoint: string;
    details?: unknown;
    requestId?: string;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code ?? `HTTP_${params.status}`;
    this.endpoint = params.endpoint;
    this.details = params.details;
    this.requestId = params.requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export type QueryParams = Record<
  string,
  string | number | boolean | undefined | null
>;

export function buildApiUrl(path: string, query?: QueryParams): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${cleanPath}`;
  if (!query) return url;

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    search.set(k, String(v));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  headers?: Record<string, string>;
  timeoutMs?: number;
  skipAuth?: boolean;
  signal?: AbortSignal;
}

/**
 * Core HTTP request wrapper with base URL resolution, Bearer token injection,
 * request timeout protection, and normalized ApiError handling.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const url = buildApiUrl(path, options.query);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };

  if (!options.skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let payload: BodyInit | undefined;
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && options.body instanceof Blob;

  if (options.body !== undefined) {
    if (isFormData || isBlob || typeof options.body === 'string') {
      payload = options.body as BodyInit;
    } else {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
      payload = JSON.stringify(options.body);
    }
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onAbortFromCaller = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', onAbortFromCaller, { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const rawText = await response.text();

    let parsed: unknown = undefined;
    if (rawText) {
      if (isJson) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = rawText;
        }
      } else {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = rawText;
        }
      }
    }

    if (!response.ok) {
      if (response.status === 401 && !options.skipAuth) {
        clearAuthToken();
        unauthorizedHandler?.();
      }

      const errBody =
        parsed && typeof parsed === 'object' ? (parsed as ApiErrorPayload) : undefined;
      const errMessage =
        errBody?.error?.message ??
        errBody?.message ??
        (typeof parsed === 'string' && parsed.trim().length > 0
          ? parsed
          : `Request failed with HTTP ${response.status}`);
      const errCode =
        errBody?.error?.code ?? errBody?.code ?? `HTTP_${response.status}`;

      throw new ApiError({
        message: errMessage,
        status: response.status,
        code: errCode,
        endpoint: path,
        details: errBody?.error?.details ?? errBody?.details,
        requestId: errBody?.requestId,
      });
    }

    return parsed as T;
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError({
        message: `Request to ${path} timed out after ${timeoutMs}ms.`,
        status: 408,
        code: 'REQUEST_TIMEOUT',
        endpoint: path,
      });
    }
    throw new ApiError({
      message:
        error instanceof Error
          ? error.message
          : 'Network error communicating with Karur Fresh Mart server.',
      status: 0,
      code: 'NETWORK_ERROR',
      endpoint: path,
    });
  } finally {
    clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener('abort', onAbortFromCaller);
    }
  }
}

export const apiClient = {
  get<T>(path: string, query?: QueryParams, options?: Omit<ApiRequestOptions, 'method' | 'query'>) {
    return apiRequest<T>(path, { ...options, method: 'GET', query });
  },
  post<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(path, { ...options, method: 'POST', body });
  },
  put<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(path, { ...options, method: 'PUT', body });
  },
  patch<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(path, { ...options, method: 'PATCH', body });
  },
  delete<T>(path: string, options?: Omit<ApiRequestOptions, 'method'>) {
    return apiRequest<T>(path, { ...options, method: 'DELETE' });
  },
  upload<T>(
    path: string,
    formData: FormData,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ) {
    return apiRequest<T>(path, { ...options, method: 'POST', body: formData });
  },
};

// =============================================================================
// THIRD-PARTY INTEGRATION ARCHITECTURE NOTES (BACKEND IMPLEMENTATION HOOKS)
// =============================================================================
// 1. WhatsApp OTP (Meta Cloud API Authentication Template):
//    - Frontend calls `POST /api/auth/otp/request` via `authService.requestMobileOtp`.
//    - Backend generates a CSPRNG 4-digit OTP, stores its bcrypt/SHA-256 hash in PostgreSQL
//      with 5-minute TTL + rate-limit counter, and sends a Meta WhatsApp Cloud API
//      Authentication Template message:
//      POST https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages
//      {
//        messaging_product: "whatsapp",
//        to: "91" + mobile10,
//        type: "template",
//        template: {
//          name: WHATSAPP_OTP_TEMPLATE_NAME, // approved AUTHENTICATION template
//          language: { code: "en" },
//          components: [
//            { type: "body", parameters: [{ type: "text", text: otp }] },
//            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: otp }] }
//          ]
//        }
//      }
//
// 2. Razorpay Checkout & Signature Verification:
//    - Frontend calls `POST /api/payments/create-order` (`paymentService.createPaymentOrder`).
//    - Backend invokes `razorpay.orders.create({ amount: amountPaise, currency: 'INR', receipt })`
//      and stores a `payments` row with `status = 'pending'`.
//    - Client opens `window.Razorpay(options)` using `VITE_RAZORPAY_KEY_ID` + returned `id`.
//    - On checkout callback, client calls `POST /api/payments/verify` with
//      `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`; backend verifies
//      HMAC-SHA256 using `RAZORPAY_KEY_SECRET` before confirming order + stock deduction.
//
// 3. Optech Billing Software Sync (DEFERRED — NOT USED IN CURRENT PHASE):
//    - Currently, ALL stock & price updates come strictly from Admin Manual Entry and
//      Excel/CSV upload (Section 10B) via `src/services/stockService.ts`.
//    - Future hook: Add a scheduled/manual backend adapter at
//      `POST /api/integrations/optech/sync` that reads Optech POS item_code deltas and
//      feeds the exact same transactional stock update + `stock_history` audit pipeline.
