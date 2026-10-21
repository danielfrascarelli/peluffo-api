import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { HealthCheck, type HealthCheckResult, HealthCheckService } from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";
import { ApiErrors } from "@/common/api-errors.decorator";
import { Public, ROLES, Roles } from "@/common/auth.decorator";
import { AppException, ErrorCode } from "@/common/errors";
import { ACCESS_COOKIE } from "@/common/token.service";
import { GoogleSheetsHealthIndicator } from "@/modules/health/google-sheets.health-indicator";

@ApiTags("health")
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly googleSheets: GoogleSheetsHealthIndicator,
  ) {}

  // Status only: no dependency names, versions or error text.
  @Public()
  @SkipThrottle()
  @Get("live")
  @HealthCheck()
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  // Names upstreams and their state, so it stays behind login.
  @Roles(...ROLES)
  @Get("dependencies")
  @ApiCookieAuth(ACCESS_COOKIE)
  @ApiOkResponse({ description: "Every external dependency is reachable." })
  @ApiErrors(401, 403, 429, 503)
  async dependencies(): Promise<{ status: "ok"; details: Record<string, unknown> }> {
    const result = await this.googleSheets.check();
    const sheets = result.googleSheets;
    if ("reason" in sheets) throw new AppException(ErrorCode.DependencyUnavailable, `googleSheets: ${sheets.reason}`);
    return { status: "ok", details: result };
  }
}
