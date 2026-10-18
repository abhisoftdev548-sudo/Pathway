import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { Logo } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { apiPost, fieldErrors, getApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

function AuthShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-brand-deep p-10 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-white/5" aria-hidden />
        <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-accent/10" aria-hidden />
        <div className="relative">
          <Logo className="[&_span:last-child]:text-white" />
        </div>
        <div className="relative my-auto max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">PathForge</p>
          <h2 className="mt-3 font-display text-4xl leading-tight tracking-tight">A clear next step beats a vague ambition.</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Roadmaps, daily plans and progress that reflects real work. Sign in to pick up exactly where you left off.
          </p>
          <div className="mt-8 space-y-3">
            {[
              'Three or more actionable tasks per topic',
              'Pace-aware daily scheduling',
              'Time-weighted progress, recalculated on reopen',
              'Admin-grade curriculum tooling',
            ].map((item) => (
              <p key={item} className="flex items-center gap-2 text-sm text-white/80">
                <span className="flex size-5 items-center justify-center rounded-full bg-white/10"><Check className="size-3" /></span>
                {item}
              </p>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">Progress is calculated from completed published tasks — never from clicks.</p>
      </aside>

      <main className="flex flex-col bg-canvas">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <div className="lg:hidden"><Logo /></div>
          <Link to="/" className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-md">
            <p className="eyebrow">Welcome</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Login ───────────────────────────────────────────────────────────────── */

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setErrors({});
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      navigate(from && from.startsWith('/') ? from : user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (caught) {
      const parsed = getApiError(caught);
      setError(parsed.message);
      setErrors(fieldErrors(parsed.details));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue your roadmaps, today's plan and progress history.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field label="Email" htmlFor="email" error={errors.email}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className="pl-10" value={email} onChange={(event) => setEmail(event.target.value)} required invalid={Boolean(errors.email)} />
          </div>
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              className="pl-10 pr-10"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              invalid={Boolean(errors.password)}
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Sessions use secure, HTTP-only cookies.</span>
          <Link to="/forgot-password" className="font-medium text-brand hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in <ArrowRight /></Button>
      </form>

      {import.meta.env.DEV ? (
        <Card className="mt-5 border-dashed bg-surface/70 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Sparkles className="size-3.5 text-accent" /> Demo accounts (seeded)</p>
          <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <p>Learner: <code className="font-mono text-ink">demo@pathforge.dev</code> / <code className="font-mono text-ink">Demo_PathForge_123!</code></p>
            <p>Admin: <code className="font-mono text-ink">admin@pathforge.local</code> / <code className="font-mono text-ink">Admin_PathForge_123!</code></p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setEmail('demo@pathforge.dev');
              setPassword('Demo_PathForge_123!');
            }}
          >
            Fill learner demo
          </Button>
        </Card>
      ) : null}

      <p className="mt-6 text-center text-sm text-muted">
        New to PathForge? <Link to="/register" className="font-semibold text-brand hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}

/* ── Register ────────────────────────────────────────────────────────────── */

const passwordChecks = [
  { label: 'At least 10 characters', test: (value: string) => value.length >= 10 },
  { label: 'One lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { label: 'One uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'One number', test: (value: string) => /[0-9]/.test(value) },
];

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const checks = useMemo(() => passwordChecks.map((check) => ({ ...check, passed: check.test(password) })), [password]);
  const strong = checks.every((check) => check.passed);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setErrors({});
    if (password !== confirm) {
      setErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      navigate(from && from.startsWith('/') ? from : '/dashboard', { replace: true });
    } catch (caught) {
      const parsed = getApiError(caught);
      setError(parsed.message);
      setErrors(fieldErrors(parsed.details));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Pick a roadmap, choose a pace, and start with a plan that fits your real week.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field label="Name" htmlFor="name" error={errors.name}>
          <Input id="name" autoComplete="name" placeholder="Ada Lovelace" value={name} onChange={(event) => setName(event.target.value)} required invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required invalid={Boolean(errors.email)} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a strong password"
              className="pr-10"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              invalid={Boolean(errors.password)}
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-1.5">
          {checks.map((check) => (
            <span key={check.label} className={cn('flex items-center gap-1.5 text-[11px]', check.passed ? 'text-emerald-700' : 'text-muted')}>
              <Check className={cn('size-3', check.passed ? 'opacity-100' : 'opacity-30')} /> {check.label}
            </span>
          ))}
        </div>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
          <Input id="confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat your password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required invalid={Boolean(errors.confirm)} />
        </Field>
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand" />
          Your password is hashed with bcrypt. Sessions use HTTP-only cookies with CSRF protection.
        </p>
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!strong}>
          Create account <ArrowRight />
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link to="/login" className="font-semibold text-brand hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

/* ── Forgot password ─────────────────────────────────────────────────────── */

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [devUrl, setDevUrl] = useState('');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await apiPost<{ message: string; devResetUrl?: string }>('/auth/forgot-password', { email: email.trim() });
      setMessage(response.message);
      if (response.devResetUrl) setDevUrl(response.devResetUrl);
    } catch (caught) {
      setError(getApiError(caught).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email and we'll prepare a single-use reset link that expires in 30 minutes.">
      {message ? (
        <div className="space-y-4">
          <Alert tone="success" title="Check your inbox">{message}</Alert>
          {devUrl ? (
            <Card className="border-dashed p-4">
              <p className="text-xs font-semibold text-ink">Development mode</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">No email provider is configured. Use this single-use link to continue:</p>
              <Link to={devUrl.replace(/^https?:\/\/[^/]+/, '')} className="mt-2 block break-all text-xs font-medium text-brand hover:underline">{devUrl}</Link>
            </Card>
          ) : null}
          <Button asChild variant="outline" className="w-full"><Link to="/login">Back to sign in</Link></Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Send reset link</Button>
          <Button asChild variant="ghost" className="w-full"><Link to="/login">Back to sign in</Link></Button>
        </form>
      )}
    </AuthShell>
  );
}

/* ── Reset password ──────────────────────────────────────────────────────── */

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const checks = useMemo(() => passwordChecks.map((check) => ({ ...check, passed: check.test(password) })), [password]);
  const strong = checks.every((check) => check.passed);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiPost('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (caught) {
      setError(getApiError(caught).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Your reset link is single-use. Signing in elsewhere will require the new password.">
      {!token ? (
        <Alert tone="danger" title="Missing reset token">Open the link from your reset email, or request a new one.</Alert>
      ) : success ? (
        <div className="space-y-4">
          <Alert tone="success" title="Password updated">Your password has been changed and all previous sessions were revoked.</Alert>
          <Button className="w-full" onClick={() => navigate('/login')}>Sign in with your new password</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label="New password" htmlFor="password">
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-1.5">
            {checks.map((check) => (
              <span key={check.label} className={cn('flex items-center gap-1.5 text-[11px]', check.passed ? 'text-emerald-700' : 'text-muted')}>
                <Check className={cn('size-3', check.passed ? 'opacity-100' : 'opacity-30')} /> {check.label}
              </span>
            ))}
          </div>
          <Field label="Confirm new password" htmlFor="confirm">
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!strong}>Update password</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted"><Link to="/login" className="font-medium text-brand hover:underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
