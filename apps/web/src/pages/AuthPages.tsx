import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn, Sparkles, UserPlus } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { Button } from '../components/ui/button';
import { FieldError, Input, Label, Textarea } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

function Shell({ title, sub, children }: any) {
  return <div className="mx-auto max-w-md">
    <div className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl brand-gradient text-white"><Sparkles className="h-5 w-5" /></span>
      <h1 className="mt-4 text-2xl font-extrabold text-navy-950">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{sub}</p>
      <div className="mt-6">{children}</div>
    </div>
  </div>;
}

const loginSchema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Password is required') });
export function Login() {
  const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const { toast } = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema) });
  const onSubmit = async (v: any) => {
    try { const u = await login(v.email, v.password); toast(`Welcome back, ${u.displayName.split(' ')[0]}!`); navigate((location.state as any)?.from || (u.role === 'admin' ? '/admin' : '/dashboard')); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  const demo = async (email: string, password: string) => { try { const u = await login(email, password); navigate(u.role === 'admin' ? '/admin' : '/dashboard'); } catch (e) { toast(errMsg(e), 'error'); } };
  return <Shell title="Welcome back" sub="Log in to attempt quizzes, create your own, and track your progress.">
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" {...register('email')} /><FieldError>{errors.email?.message as string}</FieldError></div>
      <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" {...register('password')} /><FieldError>{errors.password?.message as string}</FieldError></div>
      <Button className="w-full" size="lg" disabled={isSubmitting}><LogIn className="h-4 w-4" />{isSubmitting ? 'Logging in…' : 'Log in'}</Button>
    </form>
    <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
      <p className="font-bold text-navy-950">Demo accounts</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => demo('arjun@example.com', 'Learner@123')}>Learner</Button>
        <Button size="sm" variant="outline" onClick={() => demo('maya@example.com', 'Creator@123')}>Creator</Button>
        <Button size="sm" variant="outline" onClick={() => demo('admin@quizsphere.local', 'Admin@123')}>Admin</Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">arjun@example.com / Learner@123 · maya@example.com / Creator@123 · admin@quizsphere.local / Admin@123</p>
    </div>
    <p className="mt-5 text-center text-sm text-slate-500">No account yet? <Link className="font-bold text-brand-600" to="/register">Sign up free</Link> · <Link className="font-bold text-brand-600" to="/forgot-password">Forgot password</Link></p>
  </Shell>;
}

const regSchema = z.object({
  displayName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  bio: z.string().max(500).optional(),
});
export function Register() {
  const { register: signUp } = useAuth(); const navigate = useNavigate(); const { toast } = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(regSchema) });
  const onSubmit = async (v: any) => {
    try { await signUp(v.displayName, v.email, v.password, v.bio || ''); toast('Account created — welcome to QuizSphere!'); navigate('/dashboard'); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  return <Shell title="Create your account" sub="Attempt community quizzes and publish your own after a quick moderation review.">
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div><Label htmlFor="name">Display name</Label><Input id="name" autoComplete="name" {...register('displayName')} /><FieldError>{errors.displayName?.message as string}</FieldError></div>
      <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" {...register('email')} /><FieldError>{errors.email?.message as string}</FieldError></div>
      <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="new-password" {...register('password')} /><FieldError>{errors.password?.message as string}</FieldError></div>
      <div><Label htmlFor="bio">Bio (optional, shown on your public creator profile)</Label><Textarea id="bio" {...register('bio')} /></div>
      <Button className="w-full" size="lg" disabled={isSubmitting}><UserPlus className="h-4 w-4" />{isSubmitting ? 'Creating…' : 'Create account'}</Button>
    </form>
    <p className="mt-5 text-center text-sm text-slate-500">Already registered? <Link className="font-bold text-brand-600" to="/login">Log in</Link></p>
  </Shell>;
}

export function ForgotPassword() {
  const { toast } = useToast(); const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: any) => {
    e.preventDefault(); setBusy(true);
    try {
      const { data } = await api.post('/api/auth/forgot-password', { email });
      if (data.resetToken) { toast('Reset token generated (dev mode — in production it is emailed).', 'info'); navigate(`/reset-password?token=${data.resetToken}`); }
      else toast('If that email exists, a reset link has been sent.', 'info');
    } catch (err) { toast(errMsg(err), 'error'); } finally { setBusy(false); }
  };
  return <Shell title="Reset your password" sub="Enter your account email and we will create a one-hour reset link.">
    <form onSubmit={submit} className="space-y-4">
      <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
      <Button className="w-full" size="lg" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
    </form>
  </Shell>;
}

export function ResetPassword() {
  const [params] = useSearchParams(); const { toast } = useToast(); const navigate = useNavigate();
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  const token = params.get('token') || '';
  const submit = async (e: any) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/api/auth/reset-password', { token, password }); toast('Password updated — please log in.'); navigate('/login'); }
    catch (err) { toast(errMsg(err), 'error'); } finally { setBusy(false); }
  };
  return <Shell title="Choose a new password" sub={token ? 'Your reset link is valid for one hour.' : 'This page needs a reset token — request one from the forgot-password page.'}>
    <form onSubmit={submit} className="space-y-4">
      <div><Label htmlFor="pw">New password (min 8 characters)</Label><Input id="pw" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></div>
      <Button className="w-full" size="lg" disabled={busy || !token}>{busy ? 'Updating…' : 'Update password'}</Button>
    </form>
  </Shell>;
}
