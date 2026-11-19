import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/features/auth/auth-context';
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/route-guards';
import { AppPage } from '@/pages/app-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { SignInPage } from '@/pages/sign-in-page';
import { SignUpPage } from '@/pages/sign-up-page';
import { toApiError } from '@/lib/api/errors';

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/app" replace /> },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/signin', element: <SignInPage /> },
      { path: '/signup', element: <SignUpPage /> },
    ],
  },
  { element: <ProtectedRoute />, children: [{ path: '/app', element: <AppPage /> }] },
  { path: '*', element: <NotFoundPage /> },
];

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retrying 4xx (e.g. 401 after logout) only delays the inevitable.
        retry: (failureCount, error) => {
          const status = toApiError(error)?.statusCode ?? 0;
          return status < 400 || status >= 500 ? failureCount < 2 : false;
        },
      },
    },
  });
}

const router = createBrowserRouter(routes);
const queryClient = createQueryClient();

export function App(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
