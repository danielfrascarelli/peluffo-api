import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Request } from "express";

export const ROLES = ["peluffo", "colibri", "fibras"] as const;
export type Role = (typeof ROLES)[number];

export interface AuthUser {
  id: string;
  role: Role;
}

export type AuthRequest = Request & { user?: AuthUser };

export const IS_PUBLIC_KEY = "isPublic";
export const ROLES_KEY = "roles";

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

// Every non-public route must declare who may call it; the guard denies routes without it.
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | undefined => ctx.switchToHttp().getRequest<AuthRequest>().user,
);
