import type { Request } from 'express';
import { fakeRequest } from '../../../test/utils/http';
import { clientContextFrom } from './request-context';

describe('clientContextFrom', () => {
  it('extracts ip and user agent', () => {
    const req = fakeRequest({ 'user-agent': 'Mozilla' }, { ip: '10.0.0.1' }) as Request;
    expect(clientContextFrom(req)).toEqual({ ip: '10.0.0.1', userAgent: 'Mozilla' });
  });

  it('uses null when unknown and truncates huge user agents', () => {
    expect(clientContextFrom(fakeRequest() as Request)).toEqual({ ip: null, userAgent: null });
    const long = clientContextFrom(fakeRequest({ 'user-agent': 'x'.repeat(2000) }) as Request);
    expect(long.userAgent).toHaveLength(512);
  });
});
