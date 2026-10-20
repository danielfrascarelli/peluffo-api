import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type AuthRequest, IS_PUBLIC_KEY, type Role, ROLES_KEY } from "@/common/auth.decorator";
import { AppException, ErrorCode } from "@/common/errors";
import { ACCESS_COOKIE, TokenService } from "@/common/token.service";

// Registered as APP_GUARD: every route needs a valid access cookie and a @Roles match unless marked @Public().
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const user = await this.tokens.verifyAccess((req.cookies as Record<string, unknown> | undefined)?.[ACCESS_COOKIE]);

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (!roles?.includes(user.role)) throw new AppException(ErrorCode.Forbidden);

    req.user = user;
    return true;
  }
}
