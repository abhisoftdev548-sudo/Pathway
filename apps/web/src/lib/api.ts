import axios from 'axios';

/** Relative base URL: the Vite dev proxy (and a Vercel rewrite in production)
 *  forwards /api to the backend, so the browser never talks to localhost. */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
});

export function errMsg(e: any, fallback = 'Something went wrong'): string {
  const err = e?.response?.data?.error;
  if (err?.details?.errors?.length) return err.details.errors.join(' ');
  if (err?.details?.fieldErrors) {
    const fields = Object.entries(err.details.fieldErrors).map(([k, v]: any) => `${k}: ${(v as string[]).join(', ')}`);
    if (fields.length) return fields.join(' · ');
  }
  return err?.message || e?.message || fallback;
}
export function errList(e: any): string[] {
  const errs = e?.response?.data?.error?.details?.errors;
  return Array.isArray(errs) ? errs : [errMsg(e)];
}
