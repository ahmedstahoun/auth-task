import { http, HttpResponse } from 'msw';
import { API, apiError, authResponse, server, user } from '@/test/server';
import { api, onSessionChange, refreshSession } from './client';
import { tokenStore } from './token-store';

describe('api client', () => {
  it('attaches the in-memory access token', async () => {
    tokenStore.set('abc');
    let auth: string | null = null;
    server.use(
      http.get(`${API}/users/me`, ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json(user);
      }),
    );
    await api.get('/users/me');
    expect(auth).toBe('Bearer abc');
  });

  it('refreshes once on 401 and retries the original request with the new token', async () => {
    tokenStore.set('expired');
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse('fresh'))),
      http.get(`${API}/users/me`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json(user)
          : HttpResponse.json(apiError(401, 'expired'), { status: 401 }),
      ),
    );
    const res = await api.get('/users/me');
    expect(res.status).toBe(200);
    expect(tokenStore.get()).toBe('fresh');
  });

  it('shares a single refresh between concurrent 401s (no false reuse detection)', async () => {
    tokenStore.set('expired');
    let refreshes = 0;
    server.use(
      http.post(`${API}/auth/refresh`, async () => {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 20));
        return HttpResponse.json(authResponse('fresh'));
      }),
      http.get(`${API}/users/me`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json(user)
          : HttpResponse.json(apiError(401, 'expired'), { status: 401 }),
      ),
    );
    await Promise.all([api.get('/users/me'), api.get('/users/me'), api.get('/users/me')]);
    expect(refreshes).toBe(1);
  });

  it('gives up and clears the session when refresh fails', async () => {
    tokenStore.set('expired');
    const events: unknown[] = [];
    const off = onSessionChange((s) => events.push(s));
    server.use(
      http.get(`${API}/users/me`, () =>
        HttpResponse.json(apiError(401, 'expired'), { status: 401 }),
      ),
    );

    await expect(api.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } });
    expect(tokenStore.get()).toBeNull();
    expect(events).toEqual([null]);
    off();
  });

  it('does not retry forever if the retried request is still 401', async () => {
    let calls = 0;
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse('fresh'))),
      http.get(`${API}/users/me`, () => {
        calls += 1;
        return HttpResponse.json(apiError(401, 'no'), { status: 401 });
      }),
    );
    await expect(api.get('/users/me')).rejects.toBeDefined();
    expect(calls).toBe(2);
  });

  it('never tries to refresh on credential endpoints', async () => {
    let refreshed = false;
    server.use(
      http.post(`${API}/auth/refresh`, () => {
        refreshed = true;
        return HttpResponse.json(authResponse());
      }),
      http.post(`${API}/auth/signin`, () =>
        HttpResponse.json(apiError(401, 'Invalid credentials'), { status: 401 }),
      ),
    );
    await expect(api.post('/auth/signin', {})).rejects.toBeDefined();
    expect(refreshed).toBe(false);
  });

  it('treats a malformed refresh response as a failed refresh', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json({ accessToken: 42 })));
    await expect(refreshSession()).resolves.toBeNull();
  });
});
