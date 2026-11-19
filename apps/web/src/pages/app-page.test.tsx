import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API, authResponse, server, user } from '@/test/server';
import { renderApp } from '@/test/render';

function signedIn() {
  server.use(
    http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse())),
    http.get(`${API}/users/me`, () => HttpResponse.json(user)),
  );
}

describe('App page', () => {
  it('shows the welcome message and the profile from the protected endpoint', async () => {
    signedIn();
    renderApp('/app');
    expect(
      await screen.findByRole('heading', { name: 'Welcome to the application.' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('jane@example.com', { exact: false })).toBeInTheDocument();
  });

  it('logs out and returns to sign in', async () => {
    signedIn();
    let loggedOut = false;
    server.use(
      http.post(`${API}/auth/logout`, () => {
        loggedOut = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = renderApp('/app');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(loggedOut).toBe(true);
    expect(router.state.location.pathname).toBe('/signin');
  });

  it('logs out everywhere', async () => {
    signedIn();
    let called = false;
    server.use(
      http.post(`${API}/auth/logout-all`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp('/app');
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Log out everywhere' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(called).toBe(true);
  });

  it('still clears the local session if the logout request fails', async () => {
    signedIn();
    server.use(http.post(`${API}/auth/logout`, () => HttpResponse.error()));
    renderApp('/app');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});
