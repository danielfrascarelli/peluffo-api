import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { CookieOptions, Response } from "express";
import type { AuthUser, Role } from "@/common/auth.decorator";
import { API_PREFIX, API_VERSION, EnvNames } from "@/common/config.options";
import { AppException, ErrorCode } from "@/common/errors";

// __Host- pins the cookie to this exact host, path "/", Secure. Browsers treat http://localhost as secure.
export const ACCESS_COOKIE = "__Host-access_token";
export const REFRESH_COOKIE = "__Secure-refresh_token";
// Only refresh and logout ever see the refresh token.
const REFRESH_PATH = `/${API_PREFIX}/v${API_VERSION}/auth`;

const ALGORITHM = "HS256";
const ISSUER = "peluffo-backend";
const AUDIENCE = "peluffo-web";

interface AccessClaims {
  sub: string;
  role: Role;
  type: "access";
}

export interface RefreshClaims {
  sub: string;
  type: "refresh";
  jti: string;
  fam: string;
  exp: number;
}

export interface IssuedRefresh {
  token: string;
  jti: string;
  expiresAt: number;
}

export interface IssuedTokens {
  access: string;
  refresh: IssuedRefresh;
}

const cookieBase: CookieOptions = { httpOnly: true, secure: true, sameSite: "strict" };

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccess(user: AuthUser): Promise<string> {
    const claims: AccessClaims = { sub: user.id, role: user.role, type: "access" };
    return this.jwt.signAsync(claims, {
      secret: this.config.getOrThrow<string>(EnvNames.JwtAccessSecret),
      expiresIn: this.accessTtl(),
      algorithm: ALGORITHM,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  }

  async signRefresh(userId: string, family: string): Promise<IssuedRefresh> {
    const jti = randomUUID();
    const ttl = this.config.getOrThrow<number>(EnvNames.JwtRefreshTtl);
    const token = await this.jwt.signAsync(
      { sub: userId, type: "refresh", fam: family },
      {
        secret: this.config.getOrThrow<string>(EnvNames.JwtRefreshSecret),
        expiresIn: ttl,
        jwtid: jti,
        algorithm: ALGORITHM,
        issuer: ISSUER,
        audience: AUDIENCE,
      },
    );
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return { token, jti, expiresAt: exp * 1000 };
  }

  async verifyAccess(token: unknown): Promise<AuthUser> {
    const claims = await this.verify<AccessClaims>(token, EnvNames.JwtAccessSecret, "access");
    return { id: claims.sub, role: claims.role };
  }

  verifyRefresh(token: unknown): Promise<RefreshClaims> {
    return this.verify<RefreshClaims>(token, EnvNames.JwtRefreshSecret, "refresh");
  }

  setCookies(res: Response, tokens: IssuedTokens): void {
    res.cookie(ACCESS_COOKIE, tokens.access, { ...cookieBase, path: "/", maxAge: this.accessTtl() * 1000 });
    res.cookie(REFRESH_COOKIE, tokens.refresh.token, {
      ...cookieBase,
      path: REFRESH_PATH,
      maxAge: tokens.refresh.expiresAt - Date.now(),
    });
  }

  clearCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { ...cookieBase, path: "/" });
    res.clearCookie(REFRESH_COOKIE, { ...cookieBase, path: REFRESH_PATH });
  }

  private accessTtl(): number {
    return this.config.getOrThrow<number>(EnvNames.JwtAccessTtl);
  }

  private async verify<T extends { type: string }>(token: unknown, secretName: string, type: T["type"]): Promise<T> {
    if (typeof token !== "string" || !token) throw new AppException(ErrorCode.Unauthenticated);
    const claims = await this.jwt
      .verifyAsync<T>(token, {
        secret: this.config.getOrThrow<string>(secretName),
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
      })
      .catch((error: unknown) => {
        throw new AppException(ErrorCode.Unauthenticated, "Invalid or expired token", { cause: error });
      });
    if (claims.type !== type) throw new AppException(ErrorCode.Unauthenticated);
    return claims;
  }
}
