import type { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from './auth-context';

function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}

const fromStateSchema = z.object({ from: z.string().startsWith('/') });

/** Where to go after signing in: the page that redirected here, if it was an internal path. */
export function useRedirectTarget(fallback = '/app'): string {
  const state: unknown = useLocation().state;
  const parsed = fromStateSchema.safeParse(state);
  return parsed.success && !parsed.data.from.startsWith('//') ? parsed.data.from : fallback;
}

export function ProtectedRoute(): ReactElement {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'anonymous')
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function PublicOnlyRoute(): ReactElement {
  const { status } = useAuth();
  const target = useRedirectTarget();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') return <Navigate to={target} replace />;
  return <Outlet />;
}
