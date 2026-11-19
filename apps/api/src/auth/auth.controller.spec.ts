import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  buildClient,
  buildSignInInput,
  buildSignUpInput,
  buildUserDto,
} from '../../test/utils/factories';
import { mockConfig } from '../../test/utils/mocks';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { AuthResult } from './interfaces/auth-result.interface';

describe('AuthController', () => {
  let auth: DeepMocked<AuthService>;
  let controller: AuthController;
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };
  const client = buildClient();
  const result: AuthResult = {
    body: { accessToken: 'access', expiresIn: 900, user: buildUserDto() },
    refresh: { token: 'refresh', jti: 'jti', expiresAt: new Date(Date.now() + 1000) },
    sessionId: 'sid',
  };
  const response = (): Response => res as unknown as Response;
  const request = (cookies: Record<string, string> = {}): Request => ({ cookies }) as Request;

  beforeEach(() => {
    auth = createMock<AuthService>();
    controller = new AuthController(auth, mockConfig());
    res = { cookie: jest.fn(), clearCookie: jest.fn() };
  });

  it('signUp returns the body and sets the refresh cookie (token never in the body)', async () => {
    auth.signUp.mockResolvedValue(result);
    const body = await controller.signUp(buildSignUpInput(), client, response());
    expect(body).toEqual(result.body);
    expect(JSON.stringify(body)).not.toContain('refresh');
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'refresh',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('signIn sets the refresh cookie', async () => {
    auth.signIn.mockResolvedValue(result);
    await controller.signIn(buildSignInInput(), client, response());
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });

  it('refresh passes the cookie value to the service and rotates the cookie', async () => {
    auth.refresh.mockResolvedValue(result);
    await controller.refresh(request({ refresh_token: 'old' }), client, response());
    expect(auth.refresh).toHaveBeenCalledWith('old', client);
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh', expect.anything());
  });

  it('refresh clears the cookie when the session is invalid', async () => {
    auth.refresh.mockRejectedValue(new UnauthorizedException());
    await expect(controller.refresh(request(), client, response())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it('refresh keeps the cookie on unexpected errors', async () => {
    auth.refresh.mockRejectedValue(new Error('db down'));
    await expect(controller.refresh(request(), client, response())).rejects.toThrow('db down');
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it('logout revokes and always clears the cookie', async () => {
    await controller.logout(request({ refresh_token: 'rt' }), client, response());
    expect(auth.logout).toHaveBeenCalledWith('rt', client);
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it('logoutAll revokes all sessions and clears the cookie', async () => {
    const user = { id: 'u', sessionId: 's' };
    await controller.logoutAll(user, client, response());
    expect(auth.logoutAll).toHaveBeenCalledWith(user, client);
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it('sessions delegates to the service', async () => {
    auth.listSessions.mockResolvedValue([]);
    await expect(controller.sessions({ id: 'u', sessionId: 's' })).resolves.toEqual([]);
  });
});
