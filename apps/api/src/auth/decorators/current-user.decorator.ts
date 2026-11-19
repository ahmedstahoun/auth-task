import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import '../interfaces/auth-user.interface';
import type { AuthUser } from '../interfaces/auth-user.interface';

/** Typed access to the principal set by JwtAuthGuard — no `req.user as any`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const { user } = ctx.switchToHttp().getRequest<Request>();
    if (!user) throw new UnauthorizedException();
    return user;
  },
);
