import type { ReactElement } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { signUpSchema, type SignUpInput } from '@auth/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { FormField } from '@/features/auth/components/form-field';
import { PasswordChecklist } from '@/features/auth/components/password-checklist';
import { PasswordInput } from '@/features/auth/components/password-input';
import { applyApiError } from '@/features/auth/form-errors';

const FIELDS = ['email', 'name', 'password'] as const;

export function SignUpPage(): ReactElement {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: 'onTouched',
    defaultValues: { email: '', name: '', password: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const serverError = errors.root?.['server']?.message;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signUp(values);
      await navigate('/app', { replace: true });
    } catch (error: unknown) {
      applyApiError(error, setError, FIELDS);
    }
  });

  return (
    <AuthLayout
      title="Create an account"
      description="Enter your details to get started"
      footer={
        <span>
          Already have an account?{' '}
          <Link
            to="/signin"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Sign in
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
        <FormField
          label="Name"
          autoComplete="name"
          placeholder="Jane Doe"
          error={errors.name?.message}
          {...register('name')}
        />
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          error={errors.password?.message}
          hint={<PasswordChecklist password={password} />}
          {...register('password')}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
