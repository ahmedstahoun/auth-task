import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';
import {
  SESSIONS_REPOSITORY,
  type SessionsRepository,
} from '../../repositories/interfaces/sessions-repository.interface';
import { TokenService } from '../../tokens/token.service';
import { SESSION_INVALID } from '../constants/auth.constants';
import '../interfaces/auth-user.interface';
import { extractBearerToken } from '../utils/bearer-token';

/**
 * Validates the access token AND that its session still exists. Checking the session makes
 * logout / logout-all / reuse-detection take effect immediately instead of after token expiry.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    @Inject(SESSIONS_REPOSITORY) private readonly sessions: SessionsRepository,
    private readonly logger: PinoLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing access token');

    const claims = await this.tokens.verifyAccess(token);
    if (!claims) throw new UnauthorizedException('Invalid or expired access token');

    const session = await this.sessions.findActive(claims.sid);
    if (session?.userId !== claims.sub) throw new UnauthorizedException(SESSION_INVALID);

    request.user = { id: claims.sub, sessionId: claims.sid };
    this.logger.assign({ userId: claims.sub });
    return true;
  }
}
