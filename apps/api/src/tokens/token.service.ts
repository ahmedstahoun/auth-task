import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { z } from 'zod';
import { AppConfig } from '../config/app-config';
import type { SignedToken } from './interfaces/signed-token.interface';
import type { AccessClaims, RefreshClaims } from './interfaces/token-claims.interface';
import { accessClaimsSchema, refreshClaimsSchema } from './schemas/token-claims.schema';

const ALGORITHM = 'HS256';

/**
 * Issues and verifies JWTs. Access and refresh tokens use separate secrets and a `typ` claim, so
 * one can never be accepted as the other. Algorithm, issuer and audience are pinned on verify,
 * and verified payloads are parsed with zod rather than trusted as typed.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  get accessTtlSeconds(): number {
    return this.config.get('JWT_ACCESS_TTL_SECONDS');
  }

  async signAccess(userId: string, sessionId: string): Promise<SignedToken> {
    const ttl = this.accessTtlSeconds;
    return this.sign('access', userId, sessionId, ttl, this.config.get('JWT_ACCESS_SECRET'));
  }

  /** Refresh tokens expire with their session (absolute lifetime, no sliding extension). */
  async signRefresh(
    userId: string,
    sessionId: string,
    sessionExpiresAt: Date,
  ): Promise<SignedToken> {
    const ttl = Math.max(1, Math.floor((sessionExpiresAt.getTime() - Date.now()) / 1000));
    return this.sign('refresh', userId, sessionId, ttl, this.config.get('JWT_REFRESH_SECRET'));
  }

  async verifyAccess(token: string): Promise<AccessClaims | null> {
    return this.verify(token, this.config.get('JWT_ACCESS_SECRET'), accessClaimsSchema);
  }

  async verifyRefresh(token: string): Promise<RefreshClaims | null> {
    return this.verify(token, this.config.get('JWT_REFRESH_SECRET'), refreshClaimsSchema);
  }

  private async sign(
    typ: 'access' | 'refresh',
    userId: string,
    sessionId: string,
    ttlSeconds: number,
    secret: string,
  ): Promise<SignedToken> {
    const jti = randomUUID();
    const token = await this.jwt.signAsync(
      { sid: sessionId, typ },
      {
        secret,
        algorithm: ALGORITHM,
        expiresIn: ttlSeconds,
        subject: userId,
        jwtid: jti,
        issuer: this.config.get('JWT_ISSUER'),
        audience: this.config.get('JWT_AUDIENCE'),
      },
    );
    return { token, jti, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  }

  private async verify<TClaims>(
    token: string,
    secret: string,
    schema: z.ZodType<TClaims>,
  ): Promise<TClaims | null> {
    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync<object>(token, {
        secret,
        algorithms: [ALGORITHM],
        issuer: this.config.get('JWT_ISSUER'),
        audience: this.config.get('JWT_AUDIENCE'),
      });
    } catch {
      return null; // expired, bad signature, wrong iss/aud/alg — all just "invalid"
    }
    const parsed = schema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  }
}
