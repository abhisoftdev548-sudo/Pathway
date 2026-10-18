import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { InlineError, EmptyState } from '@/components/ui/States';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { AuthShell, useAuthSubmit, useRedirectIfSignedIn } from './AuthPages';
import { ShieldOff } from 'lucide-react';

export function RegisterPage() {
  useRedirectIfSignedIn();
  const bootstrap = useQuery<{ features: Record<string, boolean> }>({
    queryKey: qk.bootstrap,
    queryFn: () => api.get('/meta/bootstrap'),
  });
  const { submit, error, fieldErrors, busy } = useAuthSubmit();

  if (bootstrap.data && bootstrap.data.features?.public_registration_enabled === false) {
    return (
      <AuthShell title="Registration is closed" subtitle="New accounts cannot be created at the moment." footer={<Link className="link" to="/login">Back to sign in</Link>}>
        <EmptyState
          icon={<ShieldOff className="h-4 w-4" />}
          title="Public registration is switched off"
          description="An administrator has disabled new sign-ups. Ask an administrator to create an account for you."
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free to join. No sample data is added to your account."
      footer={
        <>
          Already registered?{' '}
          <Link className="link" to="/login">
            Sign in
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
            '/auth/register',
            {
              email: String(form.get('email') ?? ''),
              username: String(form.get('username') ?? ''),
              displayName: String(form.get('displayName') ?? ''),
              password: String(form.get('password') ?? ''),
            },
            () => {
              window.location.assign('/app');
            },
          );
        }}
      >
        <TextInput label="Email" name="email" type="email" autoComplete="email" required error={fieldErrors.email} />
        <TextInput
          label="Username"
          name="username"
          autoComplete="username"
          required
          error={fieldErrors.username}
          hint="Lowercase letters, numbers and underscores. 3–24 characters."
        />
        <TextInput
          label="Display name"
          name="displayName"
          autoComplete="name"
          required
          error={fieldErrors.displayName}
          hint="Shown on leaderboards and next to your content."
        />
        <TextInput
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          error={fieldErrors.password}
          hint="At least 10 characters, including a letter and a number."
        />
        <Button type="submit" variant="primary" block loading={busy}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
