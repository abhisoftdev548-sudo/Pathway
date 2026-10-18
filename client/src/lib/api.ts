import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

const baseURL = '/api';

const raw = axios.create({ baseURL, withCredentials: true });

let csrfToken: string | null = null;
let csrfRequest: Promise<string | null> | null = null;
let refreshRequest: Promise<void> | null = null;

export const api = axios.create({ baseURL, withCredentials: true });

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export async function fetchCsrfToken(force = false): Promise<string | null> {
  if (csrfToken && !force) return csrfToken;
  if (csrfRequest) return csrfRequest;
  csrfRequest = raw
    .get<{ csrfToken: string }>('/auth/csrf')
    .then((response) => {
      csrfToken = response.data.csrfToken;
      return csrfToken;
    })
    .catch(() => null)
    .finally(() => {
      csrfRequest = null;
    });
  return csrfRequest;
}

async function refreshSession(): Promise<void> {
  if (!refreshRequest) {
    refreshRequest = raw
      .post<{ csrfToken?: string }>('/auth/refresh')
      .then((response) => {
        if (response.data?.csrfToken) csrfToken = response.data.csrfToken;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

const unsafeMethods = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toLowerCase();
  const isAuthEndpoint = (config.url ?? '').startsWith('/auth/');
  if (unsafeMethods.has(method) && !isAuthEndpoint) {
    const token = await fetchCsrfToken();
    if (token) config.headers.set('x-csrf-token', token);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const url = config?.url ?? '';
    if (status === 401 && config && !config._retried && !url.startsWith('/auth/')) {
      config._retried = true;
      try {
        await refreshSession();
        return api.request(config);
      } catch {
        // Fall through to the original error; the app will show a signed-out state.
      }
    }
    return Promise.reject(error);
  },
);

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export function getApiError(error: unknown): { message: string; details: ApiErrorDetail[]; status?: number } {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: { message?: string; details?: unknown }; message?: string }
      | undefined;
    const details = Array.isArray(data?.error?.details)
      ? (data?.error?.details as ApiErrorDetail[]).filter((detail) => detail && typeof detail.message === 'string')
      : [];
    return {
      message:
        data?.error?.message ??
        data?.message ??
        (error.code === 'ERR_NETWORK'
          ? 'Cannot reach the PathForge API. Check that the server is running.'
          : 'Something went wrong. Please try again.'),
      details,
      status: error.response?.status,
    };
  }
  if (error instanceof Error) return { message: error.message, details: [] };
  return { message: 'Something went wrong. Please try again.', details: [] };
}

export function fieldErrors(details: ApiErrorDetail[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const detail of details) {
    if (detail.path && !result[detail.path]) result[detail.path] = detail.message;
  }
  return result;
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.get<T>(url, config);
  return response.data;
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.post<T>(url, body, config);
  return response.data;
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.patch<T>(url, body, config);
  return response.data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.delete<T>(url, config);
  return response.data;
}
