import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { tokenStore } from '@/lib/api/token-store';
import { server } from './server';

// jsdom does not implement matchMedia; browsers always do.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList =>
    Object.assign(new EventTarget(), {
      matches: false,
      media: query,
      onchange: null,
    }) as unknown as MediaQueryList,
});

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  tokenStore.set(null);
});
afterAll(() => {
  server.close();
});
