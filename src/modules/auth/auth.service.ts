import { randomUUID } from "node:crypto";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { hash, verify } from "argon2";
import { AppException, ErrorCode } from "@/common/errors";
import { type IssuedTokens, TokenService } from "@/common/token.service";
import { JsonDataAccessor, type UserRecord } from "@/data/json-data.accessor";
import { SessionAccessor } from "@/data/session.accessor";
import type { UserDto } from "@/modules/auth/dto/user.dto";

@Injectable()
export class AuthService implements OnModuleInit {
  // Verified against when the username does not exist, so both failures take the same time.
  private dummyHash = "";

  constructor(
    private readonly data: JsonDataAccessor,
    private readonly sessions: SessionAccessor,
    private readonly tokens: TokenService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await hash(randomUUID());
  }

  async login(username: string, password: string): Promise<{ user: UserDto; tokens: IssuedTokens }> {
    const user = this.data.findUserByUsername(username);
    const valid = await verify(user?.passwordHash ?? this.dummyHash, password);
    if (!user || !valid) throw new AppException(ErrorCode.InvalidCredentials);
    return { user: toUserDto(user), tokens: await this.issue(user, randomUUID()) };
  }

  // Rotation with reuse detection: presenting an already-rotated refresh token ends the whole session,
  // because either the legitimate client or a thief now holds a stale copy.
  async refresh(refreshToken: unknown): Promise<IssuedTokens> {
    const claims = await this.tokens.verifyRefresh(refreshToken);
    const session = this.sessions.get(claims.fam);
    const user = this.data.findUserById(claims.sub);
    if (!session || !user || session.userId !== user.id || session.currentJti !== claims.jti) {
      this.sessions.delete(claims.fam);
      throw new AppException(ErrorCode.Unauthenticated, "Session expired");
    }
    return this.issue(user, claims.fam);
  }

  async logout(refreshToken: unknown): Promise<void> {
    // An invalid or expired cookie has no session left to revoke.
    const claims = await this.tokens.verifyRefresh(refreshToken).catch(() => undefined);
    if (claims) this.sessions.delete(claims.fam);
  }

  me(userId: string): UserDto {
    const user = this.data.findUserById(userId);
    if (!user) throw new AppException(ErrorCode.Unauthenticated);
    return toUserDto(user);
  }

  private async issue(user: UserRecord, family: string): Promise<IssuedTokens> {
    const [access, refresh] = await Promise.all([
      this.tokens.signAccess(user),
      this.tokens.signRefresh(user.id, family),
    ]);
    this.sessions.set(family, { userId: user.id, currentJti: refresh.jti, expiresAt: refresh.expiresAt });
    return { access, refresh };
  }
}

function toUserDto({ passwordHash, ...user }: UserRecord): UserDto {
  return user;
}
