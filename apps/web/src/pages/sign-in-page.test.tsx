import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API, apiError, authResponse, server, user } from '@/test/server';
import { renderApp } from '@/test/render';

async function signIn(email = 'jane@example.com', password = 'Str0ng!pass') {
  const u = userEvent.setup();
  await u.type(await screen.findByLabelText('Email'), email);
  await u.type(screen.getByLabelText('Password'), password);
  await u.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('Sign in page', () => {
  it('redirects to the welcome page on success', async () => {
    server.use(
      http.post(`${API}/auth/signin`, () => HttpResponse.json(authResponse())),
      http.get(`${API}/users/me`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer access-1'
          ? HttpResponse.json(user)
          : HttpResponse.json(apiError(401, 'no'), { status: 401 }),
      ),
    );
    const { router } = renderApp('/signin');
    await signIn();

    expect(
      await screen.findByRole('heading', { name: 'Welcome to the application.' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('shows the generic error for invalid credentials', async () => {
    server.use(
      http.post(`${API}/auth/signin`, () =>
        HttpResponse.json(apiError(401, 'Invalid credentials'), { status: 401 }),
      ),
    );
    renderApp('/signin');
    await signIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
  });

  it('explains rate limiting / lockout', async () => {
    server.use(
      http.post(`${API}/auth/signin`, () =>
        HttpResponse.json(
          apiError(429, 'Too many failed sign-in attempts. Please try again later.'),
          { status: 429 },
        ),
      ),
    );
    renderApp('/signin');
    await signIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many failed sign-in attempts');
  });

  it('reports network failures without crashing', async () => {
    server.use(http.post(`${API}/auth/signin`, () => HttpResponse.error()));
    renderApp('/signin');
    await signIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });

  it('requires both fields', async () => {
    renderApp('/signin');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
  });
});
