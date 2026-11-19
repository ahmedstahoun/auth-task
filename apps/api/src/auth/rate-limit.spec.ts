import type { ThrottlerOptions } from '@nestjs/throttler';
import { httpContext, fakeRequest } from '../../test/utils/http';
import { mockConfig } from '../../test/utils/mocks';
import { AuthRateLimited, buildThrottlerOptions } from './rate-limit';

class Routes {
  @AuthRateLimited()
  signIn(): void {
    // fake credential route
  }

  profile(): void {
    // fake regular route
  }
}

describe('buildThrottlerOptions', () => {
  const options = buildThrottlerOptions(mockConfig({ AUTH_RATE_LIMIT_PER_MINUTE: 7 }));
  const throttlers: ThrottlerOptions[] = Array.isArray(options) ? options : options.throttlers;
  const auth = throttlers.find((t) => t.name === 'auth');

  it('configures the strict auth limit from env', () => {
    expect(auth).toMatchObject({ limit: 7, ttl: 60_000 });
  });

  it('applies the auth throttler only to @AuthRateLimited routes', () => {
    const routes = new Routes();
    expect(auth?.skipIf?.(httpContext(fakeRequest(), routes.signIn.bind(routes)))).toBe(true);
    expect(auth?.skipIf?.(httpContext(fakeRequest(), Routes.prototype.signIn))).toBe(false);
    expect(auth?.skipIf?.(httpContext(fakeRequest(), Routes.prototype.profile))).toBe(true);
  });
});
