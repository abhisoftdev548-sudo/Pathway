import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';

export function useRedirectIfSignedIn(): void {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ user: unknown }>('/auth/me')
      .then((me) => {
        if (!cancelled && me.user) navigate('/app', { replace: true });
        else if (!cancelled) setChecked(true);
      })
      .catch(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  void checked;
}

export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function useAuthSubmit() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit<T>(path: string, body: unknown, onSuccess: (result: T) => void) {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await api.post<T>(path, body);
      await queryClient.invalidateQueries({ queryKey: qk.me });
      onSuccess(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError(authErrorMessage(err, 'Something went wrong. Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return { submit, error, setError, fieldErrors, busy, navigate };
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-col justify-center px-4 py-12 sm:py-20">
      <Link to="/" className="mb-6 flex items-center gap-2 self-center">
        <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-600 text-[13px] font-semibold text-white">
          Q
        </span>
        <span className="text-sm font-semibold text-ink">QuizSphere</span>
      </Link>
      <div className="surface p-6">
        <h1 className="text-[17px] font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p>
        <div className="mt-5 space-y-4">{children}</div>
      </div>
      <p className="mt-4 text-center text-[13px] text-ink-muted">{footer}</p>
    </div>
  );
}

export { Link };
