import { AxiosError, AxiosHeaders } from 'axios';
import { apiError } from '@/test/server';
import { errorMessage, toApiError } from './errors';

function axiosError(status: number | null, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response =
    status === null ? undefined : { status, statusText: '', headers: {}, config, data };
  return new AxiosError('fail', 'ERR', config, null, response);
}

describe('API errors', () => {
  it('extracts the API error contract', () => {
    const body = apiError(401, 'Invalid credentials');
    expect(toApiError(axiosError(401, body))).toEqual(body);
    expect(errorMessage(axiosError(401, body))).toBe('Invalid credentials');
  });

  it('ignores bodies that do not match the contract', () => {
    expect(toApiError(axiosError(500, '<html>'))).toBeNull();
    expect(toApiError(new Error('x'))).toBeNull();
    expect(errorMessage(axiosError(500, '<html>'))).toBe('Something went wrong. Please try again.');
  });

  it('describes network failures', () => {
    expect(errorMessage(axiosError(null))).toMatch(/cannot reach the server/i);
  });
});
