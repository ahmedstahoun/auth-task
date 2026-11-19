import { ForbiddenException } from '@nestjs/common';
import { fakeRequest, httpContext } from '../../../test/utils/http';
import { mockConfig } from '../../../test/utils/mocks';
import { OriginGuard } from './origin.guard';

describe('OriginGuard', () => {
  const guard = new OriginGuard(mockConfig({ CORS_ORIGINS: ['https://app.example.com'] }));

  it('allows a configured origin', () => {
    expect(guard.canActivate(httpContext(fakeRequest({ origin: 'https://app.example.com' })))).toBe(
      true,
    );
  });

  it.each([
    ['a foreign origin', { origin: 'https://evil.example' }],
    ['a missing origin', {}],
  ])('rejects %s', (_label, headers) => {
    expect(() => guard.canActivate(httpContext(fakeRequest(headers)))).toThrow(ForbiddenException);
  });
});
