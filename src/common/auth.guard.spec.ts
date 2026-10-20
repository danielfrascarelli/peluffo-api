import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type AuthUser, Public, Roles } from "@/common/auth.decorator";
import { AuthGuard } from "@/common/auth.guard";
import type { TokenService } from "@/common/token.service";

const fibras: AuthUser = { id: "u3", role: "fibras" };

function contextFor(handler: () => void): { ctx: ExecutionContext; req: { cookies: object; user?: AuthUser } } {
  const req = { cookies: { "__Host-access_token": "token" } };
  const ctx = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe("AuthGuard", () => {
  const tokens = { verifyAccess: jest.fn().mockResolvedValue(fibras) } as unknown as TokenService;
  const guard = new AuthGuard(new Reflector(), tokens);

  class Routes {
    @Public() open(this: void): void {}
    undeclared(this: void): void {}
    @Roles("colibri") colibriOnly(this: void): void {}
    @Roles("fibras", "peluffo") staff(this: void): void {}
  }

  it("lets public routes through without a token", async () => {
    await expect(guard.canActivate(contextFor(Routes.prototype.open).ctx)).resolves.toBe(true);
  });

  it("denies authenticated users on routes that declare no roles", async () => {
    await expect(guard.canActivate(contextFor(Routes.prototype.undeclared).ctx)).rejects.toMatchObject({ status: 403 });
  });

  it("denies a role the route does not list", async () => {
    await expect(guard.canActivate(contextFor(Routes.prototype.colibriOnly).ctx)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("attaches the user when the role matches", async () => {
    const { ctx, req } = contextFor(Routes.prototype.staff);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual(fibras);
  });
});
