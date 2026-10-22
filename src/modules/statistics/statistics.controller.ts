import { Controller, Get } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ApiErrors } from "@/common/api-errors.decorator";
import { Roles } from "@/common/auth.decorator";
import { ACCESS_COOKIE } from "@/common/token.service";
import { StatisticsDto } from "@/modules/statistics/dto/statistics.dto";
import { StatisticsService } from "@/modules/statistics/statistics.service";

@ApiTags("statistics")
@ApiCookieAuth(ACCESS_COOKIE)
@ApiErrors(401, 403, 429)
@Roles("peluffo", "fibras")
@Controller("statistics")
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get()
  @ApiOkResponse({ type: StatisticsDto })
  getStatistics(): StatisticsDto {
    return this.statistics.getStatistics();
  }
}
