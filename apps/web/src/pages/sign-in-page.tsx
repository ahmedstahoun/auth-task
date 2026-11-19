import type { ReactElement } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { signInSchema, type SignInInput } from '@auth/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { FormField } from '@/features/auth/components/form-field';
import { PasswordInput } from '@/features/auth/components/password-input';
import { applyApiError } from '@/features/auth/form-errors';
import { useRedirectTarget } from '@/features/auth/route-guards';

const FIELDS = ['email', 'password'] as const;

export function SignInPage(): ReactElement {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const redirectTo = useRedirectTarget();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const serverError = errors.root?.['server']?.message;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signIn(values);
      await navigate(redirectTo, { replace: true });
    } catch (error: unknown) {
      applyApiError(error, setError, FIELDS);
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to your account"
      footer={
        <span>
          Don&apos;t have an account?{' '}
          <Link
            to="/signup"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </span>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="grid gap-4">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
