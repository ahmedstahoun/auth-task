import { type ReactElement, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, LogOut, MonitorSmartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';
import { authApi } from '@/lib/api/auth-api';
import { errorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';

export function AppPage(): ReactElement {
  const { logout, logoutAll } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<'logout' | 'logout-all' | null>(null);
  // Exercises the protected endpoint (GET /users/me) rather than trusting cached sign-in data.
  const me = useQuery({ queryKey: queryKeys.me, queryFn: authApi.me });

  const run = async (kind: 'logout' | 'logout-all') => {
    setPending(kind);
    try {
      await (kind === 'logout' ? logout() : logoutAll());
      toast.success(kind === 'logout' ? 'Signed out' : 'Signed out of all devices');
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
      await navigate('/signin', { replace: true });
    }
  };

  return (
    <main className="bg-muted/40 relative flex min-h-svh items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            <h1>Welcome to the application.</h1>
          </CardTitle>
          <CardDescription>
            {me.isPending && (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3 animate-spin" aria-hidden /> Loading your profile…
              </span>
            )}
            {me.isError && <span className="text-destructive">{errorMessage(me.error)}</span>}
            {me.data && (
              <span>
                Signed in as <strong className="text-foreground">{me.data.name}</strong> (
                {me.data.email})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Your session is protected by a short-lived access token kept in memory and a rotating,
          httpOnly refresh cookie.
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="w-full sm:flex-1"
            onClick={() => void run('logout')}
            disabled={pending !== null}
          >
            {pending === 'logout' ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <LogOut aria-hidden />
            )}
            Log out
          </Button>
          <Button
            variant="outline"
            className="w-full sm:flex-1"
            onClick={() => void run('logout-all')}
            disabled={pending !== null}
          >
            {pending === 'logout-all' ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <MonitorSmartphone aria-hidden />
            )}
            Log out everywhere
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
