import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { ApiErrors } from "@/common/api-errors.decorator";
import { type AuthUser, CurrentUser, Public, ROLES, Roles } from "@/common/auth.decorator";
import { LOGIN_THROTTLE } from "@/common/throttler.options";
import { ACCESS_COOKIE, REFRESH_COOKIE, TokenService } from "@/common/token.service";
import { AuthService } from "@/modules/auth/auth.service";
import { LoginDto } from "@/modules/auth/dto/login.dto";
import { UserDto } from "@/modules/auth/dto/user.dto";

const refreshCookie = (req: Request): unknown => (req.cookies as Record<string, unknown>)[REFRESH_COOKIE];

@ApiTags("auth")
@ApiErrors(429)
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post("login")
  @HttpCode(200)
  @ApiOkResponse({ type: UserDto, description: "Sets the access and refresh cookies." })
  @ApiErrors(400, 401)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<UserDto> {
    const { user, tokens } = await this.auth.login(dto.username, dto.password);
    this.tokens.setCookies(res, tokens);
    return user;
  }

  @Public()
  @Post("refresh")
  @HttpCode(204)
  @ApiNoContentResponse({ description: "Rotates both cookies." })
  @ApiErrors(401)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    try {
      this.tokens.setCookies(res, await this.auth.refresh(refreshCookie(req)));
    } catch (error) {
      this.tokens.clearCookies(res);
      throw error;
    }
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  @ApiNoContentResponse({ description: "Revokes the session and clears both cookies." })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(refreshCookie(req));
    this.tokens.clearCookies(res);
  }

  @Roles(...ROLES)
  @Get("me")
  @ApiCookieAuth(ACCESS_COOKIE)
  @ApiOkResponse({ type: UserDto })
  @ApiErrors(401, 403)
  me(@CurrentUser() user: AuthUser): UserDto {
    return this.auth.me(user.id);
  }
}
