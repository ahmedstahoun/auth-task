import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { API, authResponse, server, user } from '@/test/server';
import { renderApp } from '@/test/render';

describe('route guards', () => {
  it('redirects anonymous users from /app to /signin', async () => {
    const { router } = renderApp('/app');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/signin');
  });

  it('restores the session silently from the refresh cookie', async () => {
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse())),
      http.get(`${API}/users/me`, () => HttpResponse.json(user)),
    );
    renderApp('/app');
    expect(
      await screen.findByRole('heading', { name: 'Welcome to the application.' }),
    ).toBeInTheDocument();
  });

  it('sends signed-in users away from /signin', async () => {
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse())),
      http.get(`${API}/users/me`, () => HttpResponse.json(user)),
    );
    const { router } = renderApp('/signin');
    expect(
      await screen.findByRole('heading', { name: 'Welcome to the application.' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('redirects / to /app (and on to /signin when anonymous)', async () => {
    const { router } = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/signin');
  });

  it('shows a 404 page for unknown routes', async () => {
    renderApp('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
