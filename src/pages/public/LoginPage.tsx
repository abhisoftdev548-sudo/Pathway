import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { InlineError } from '@/components/ui/States';
import { AuthShell, useAuthSubmit, useRedirectIfSignedIn } from './AuthPages';

export function LoginPage() {
  useRedirectIfSignedIn();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/app';
  const { submit, error, fieldErrors, busy } = useAuthSubmit();

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your email or username."
      footer={
        <>
          No account yet?{' '}
          <Link className="link" to="/register">
            Create one
          </Link>
        </>
      }
    >
      {error && <InlineError message={error} />}
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void submit(
            '/auth/login',
            { identifier: String(form.get('identifier') ?? ''), password: String(form.get('password') ?? '') },
            () => {
              window.location.assign(from);
            },
          );
        }}
      >
        <TextInput
          label="Email or username"
          name="identifier"
          autoComplete="username"
          required
          error={fieldErrors.identifier}
          placeholder="you@example.com"
        />
        <TextInput
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={fieldErrors.password}
        />
        <Button type="submit" variant="primary" block loading={busy}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
