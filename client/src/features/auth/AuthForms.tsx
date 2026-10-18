import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, KeyRound, MailCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import endpoints from '@/services/endpoints';
import { apiErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { Card, CardBody } from '@/components/ui/Feedback';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back');
      navigate(searchParams.get('from') ?? '/dashboard', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardBody className="px-6 py-7">
        <h1 className="text-xl font-semibold text-zinc-900">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-500">Access your quizzes, polls, and QCoin wallet.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full" icon={<ArrowRight className="h-4 w-4" />}>
            Sign in
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-brand-600 hover:text-brand-700">
            Forgot password?
          </Link>
          <Link to="/register" className="text-zinc-600 hover:text-zinc-900">
            Create an account
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      toast.success('Account created', 'Welcome to QuizSphere.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardBody className="px-6 py-7">
        <h1 className="text-xl font-semibold text-zinc-900">Create your account</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Join QuizSphere to create quizzes and polls, participate, and earn QCoins.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input label="Name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 8 characters, with a letter and a number."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full">
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-500">
          Already registered?{' '}
          <Link to="/login" className="text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await endpoints.auth.forgotPassword({ email });
      setSent(true);
      if (result.devResetToken) setDevToken(result.devResetToken);
      toast.success('Reset link requested');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not start password reset'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardBody className="px-6 py-7">
        <h1 className="text-xl font-semibold text-zinc-900">Reset your password</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your account email and we&apos;ll issue a reset link.
        </p>
        {sent ? (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div className="text-sm text-emerald-800">
                <p className="font-medium">Check your inbox</p>
                <p className="mt-1 text-emerald-700">
                  If an account exists for {email}, a reset link is on its way.
                </p>
                {devToken && (
                  <p className="mt-2 break-all rounded bg-white/70 p-2 text-xs text-emerald-900">
                    Development mode — use this token:{' '}
                    <Link to={`/reset-password?token=${devToken}`} className="font-medium underline">
                      open reset form
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" loading={loading} className="w-full" icon={<KeyRound className="h-4 w-4" />}>
              Send reset link
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const token = searchParams.get('token') ?? '';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await endpoints.auth.resetPassword({ token, password });
      toast.success('Password updated', 'All sessions were signed out.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reset password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardBody className="px-6 py-7">
        <h1 className="text-xl font-semibold text-zinc-900">Choose a new password</h1>
        {!token && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This page needs a valid reset token. Request a new link first.
          </p>
        )}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} disabled={!token} className="w-full">
            Update password
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
