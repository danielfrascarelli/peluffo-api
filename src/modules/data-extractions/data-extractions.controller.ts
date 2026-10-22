import { Controller, Post, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { ApiErrors } from "@/common/api-errors.decorator";
import { Roles } from "@/common/auth.decorator";
import { ACCESS_COOKIE } from "@/common/token.service";
import { DataExtractionsService } from "@/modules/data-extractions/data-extractions.service";
import type { DataExtractionResult } from "@/data/extraction.types";
import { DataExtractionResultDto } from "@/modules/data-extractions/dto/data-extraction-result.dto";

@ApiTags("data")
@ApiCookieAuth(ACCESS_COOKIE)
@ApiErrors(401, 403, 409, 429, 500, 503)
@Roles("fibras")
@Controller("data")
export class DataExtractionsController {
  constructor(private readonly extractions: DataExtractionsService) {}

  @Post("extractions")
  @ApiCreatedResponse({ type: DataExtractionResultDto })
  @ApiOkResponse({ type: DataExtractionResultDto, description: "Unchanged Sheet; current diagnostics, no writes" })
  async extract(@Res({ passthrough: true }) response: Response): Promise<DataExtractionResult> {
    const result = await this.extractions.extract();
    response.status(result.changed ? 201 : 200);
    return result;
  }
}
