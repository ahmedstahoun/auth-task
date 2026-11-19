import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  authResponseSchema,
  sessionDtoSchema,
  signInSchema,
  signUpSchema,
  type AuthResponse,
  type SessionDto,
  type SignInInput,
  type SignUpInput,
} from '@auth/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { OriginGuard } from '../common/guards/origin.guard';
import { Client } from '../common/decorators/client.decorator';
import type { ClientContext } from '../common/interfaces/client-context.interface';
import { zodToOpenApi } from '../common/openapi/zod-to-openapi';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AppConfig } from '../config/app-config';
import type { AuthUser } from './interfaces/auth-user.interface';
import { AuthService } from './auth.service';
import type { AuthResult } from './interfaces/auth-result.interface';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthRateLimited } from './decorators/auth-rate-limited.decorator';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './utils/refresh-cookie';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly auth: AuthService,
    config: AppConfig,
  ) {
    this.isProduction = config.isProduction;
  }

  @Post('signup')
  @AuthRateLimited()
  @ApiOperation({ summary: 'Create an account and start a session' })
  @ApiBody({ schema: zodToOpenApi(signUpSchema) })
  @ApiResponse({
    status: 201,
    schema: zodToOpenApi(authResponseSchema),
    description: 'Sets the refresh cookie',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 429, description: 'Rate limited' })
  async signUp(
    @Body(new ZodValidationPipe(signUpSchema)) body: SignUpInput,
    @Client() client: ClientContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.signUp(body, client));
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @AuthRateLimited()
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiBody({ schema: zodToOpenApi(signInSchema) })
  @ApiOkResponse({
    schema: zodToOpenApi(authResponseSchema),
    description: 'Sets the refresh cookie',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials (same response for unknown email)',
  })
  @ApiResponse({ status: 429, description: 'Rate limited or temporarily locked out' })
  async signIn(
    @Body(new ZodValidationPipe(signInSchema)) body: SignInInput,
    @Client() client: ClientContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.signIn(body, client));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  @ApiOkResponse({ schema: zodToOpenApi(authResponseSchema) })
  @ApiResponse({ status: 401, description: 'Missing, invalid, expired or reused refresh token' })
  @ApiResponse({ status: 403, description: 'Origin not allowed (CSRF protection)' })
  async refresh(
    @Req() req: Request,
    @Client() client: ClientContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    try {
      return this.respond(
        res,
        await this.auth.refresh(readRefreshCookie(req, this.isProduction), client),
      );
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) clearRefreshCookie(res, this.isProduction);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'End the current session (idempotent)' })
  @ApiResponse({ status: 204, description: 'Session revoked and cookie cleared' })
  async logout(
    @Req() req: Request,
    @Client() client: ClientContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(readRefreshCookie(req, this.isProduction), client);
    clearRefreshCookie(res, this.isProduction);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End every session of the current user (all devices)' })
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Client() client: ClientContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logoutAll(user, client);
    clearRefreshCookie(res, this.isProduction);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions of the current user' })
  @ApiOkResponse({ schema: zodToOpenApi(z.array(sessionDtoSchema)) })
  async sessions(@CurrentUser() user: AuthUser): Promise<SessionDto[]> {
    return this.auth.listSessions(user);
  }

  private respond(res: Response, result: AuthResult): AuthResponse {
    setRefreshCookie(res, result.refresh.token, result.refresh.expiresAt, this.isProduction);
    return result.body;
  }
}
