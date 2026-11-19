import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage(): ReactElement {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Button asChild variant="outline">
        <Link to="/">Go home</Link>
      </Button>
    </main>
  );
}
