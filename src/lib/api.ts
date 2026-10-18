export interface ApiErrorShape {
  error: string;
  message: string;
  details?: Record<string, string> | unknown;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get fieldErrors(): Record<string, string> {
    if (this.details && typeof this.details === 'object') return this.details as Record<string, string>;
    return {};
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
    signal: options.signal,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : ((await res.text()) as unknown);

  if (!res.ok) {
    const shape = (payload ?? {}) as Partial<ApiErrorShape>;
    throw new ApiError(
      res.status,
      shape.error ?? 'request_failed',
      shape.message ?? 'Something went wrong. Please try again.',
      shape.details,
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '' || value === 'all' || value === false) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}
