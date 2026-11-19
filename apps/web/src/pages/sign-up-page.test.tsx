import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API, apiError, authResponse, server, user } from '@/test/server';
import { renderApp } from '@/test/render';

async function fill(values: { email?: string; name?: string; password?: string }) {
  const u = userEvent.setup();
  if (values.email !== undefined) await u.type(await screen.findByLabelText('Email'), values.email);
  if (values.name !== undefined) await u.type(screen.getByLabelText('Name'), values.name);
  if (values.password !== undefined)
    await u.type(screen.getByLabelText('Password'), values.password);
  await u.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('Sign up page', () => {
  it('shows a validation message for each invalid field and does not call the API', async () => {
    let called = false;
    server.use(
      http.post(`${API}/auth/signup`, () => {
        called = true;
        return HttpResponse.json(authResponse());
      }),
    );
    renderApp('/signup');

    await fill({ email: 'not-an-email', name: 'ab', password: 'short' });

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Name must be at least 3 characters')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(called).toBe(false);
  });

  it.each([
    ['12345678!', 'Password must contain at least one letter'],
    ['Password!', 'Password must contain at least one number'],
    ['Password1', 'Password must contain at least one special character'],
  ])('rejects password %s with "%s"', async (password, message) => {
    renderApp('/signup');
    await fill({ email: 'jane@example.com', name: 'Jane', password });
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('ticks password rules live as the user types', async () => {
    renderApp('/signup');
    const u = userEvent.setup();
    const checklist = await screen.findByRole('list', { name: 'Password requirements' });
    await u.type(screen.getByLabelText('Password'), 'abc1');

    const items = Array.from(checklist.querySelectorAll('li')).map((li) => li.dataset['met']);
    expect(items).toEqual(['false', 'true', 'true', 'false']);
  });

  it('signs up and lands on the welcome page', async () => {
    server.use(
      http.post(`${API}/auth/signup`, () => HttpResponse.json(authResponse(), { status: 201 })),
    );
    server.use(http.get(`${API}/users/me`, () => HttpResponse.json(user)));
    const { router } = renderApp('/signup');

    await fill({ email: 'jane@example.com', name: 'Jane Doe', password: 'Str0ng!pass' });

    expect(
      await screen.findByRole('heading', { name: 'Welcome to the application.' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('shows a duplicate email error on the email field', async () => {
    server.use(
      http.post(`${API}/auth/signup`, () =>
        HttpResponse.json(apiError(409, 'An account with this email already exists'), {
          status: 409,
        }),
      ),
    );
    renderApp('/signup');
    await fill({ email: 'jane@example.com', name: 'Jane Doe', password: 'Str0ng!pass' });

    expect(
      await screen.findByText('An account with this email already exists'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('maps server-side field validation details to fields', async () => {
    server.use(
      http.post(`${API}/auth/signup`, () =>
        HttpResponse.json(
          apiError(400, 'Validation failed', { details: { name: ['Name is taken by policy'] } }),
          {
            status: 400,
          },
        ),
      ),
    );
    renderApp('/signup');
    await fill({ email: 'jane@example.com', name: 'Jane Doe', password: 'Str0ng!pass' });
    expect(await screen.findByText('Name is taken by policy')).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    renderApp('/signup');
    const u = userEvent.setup();
    const input = await screen.findByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await u.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});
