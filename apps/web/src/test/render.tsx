import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@/app';
import { AuthProvider } from '@/features/auth/auth-context';

export interface RenderAppResult extends RenderResult {
  router: ReturnType<typeof createMemoryRouter>;
}

/** Renders the real route tree at `path` with fresh query + auth state. */
export function renderApp(path: string): RenderAppResult {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const ui: ReactElement = (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
  return { ...render(ui), router };
}
