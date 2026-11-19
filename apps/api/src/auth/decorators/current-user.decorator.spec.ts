import { UnauthorizedException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import type { ExecutionContext } from '@nestjs/common';
import { fakeRequest, httpContext } from '../../../test/utils/http';
import { CurrentUser } from './current-user.decorator';

type Factory = (data: unknown, ctx: ExecutionContext) => unknown;

/** Extracts the factory Nest registers for a custom param decorator. */
function factoryOf(decorator: () => ParameterDecorator): Factory {
  class Host {
    handler(@decorator() _user: unknown): void {
      // only the decorator metadata matters
    }
  }
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, Host, 'handler') as Record<
    string,
    { factory: Factory }
  >;
  const entry = Object.values(metadata)[0];
  if (!entry) throw new Error('decorator metadata not found');
  return entry.factory;
}

describe('@CurrentUser', () => {
  const factory = factoryOf(CurrentUser);

  it('returns the principal set by the guard', () => {
    const user = { id: 'u1', sessionId: 's1' };
    expect(factory(undefined, httpContext(fakeRequest({}, { user })))).toEqual(user);
  });

  it('throws if used on a route without the guard', () => {
    expect(() => factory(undefined, httpContext(fakeRequest()))).toThrow(UnauthorizedException);
  });
});
