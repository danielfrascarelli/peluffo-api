import { Controller, Get } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ApiErrors } from "@/common/api-errors.decorator";
import { ROLES, Roles } from "@/common/auth.decorator";
import { ACCESS_COOKIE } from "@/common/token.service";
import { type JsonObject, JsonDataAccessor } from "@/data/json-data.accessor";

// ponytail: item schemas are owned by the frontend's zod schemas (src/lib/schemas.ts). Add DTOs when a second client appears.
const list = { schema: { type: "array", items: { type: "object" } } } as const;

// Every role reads every resource: Colibrí assigns patients to psychologists, Peluffo and Fibras browse both.
@ApiTags("resources")
@ApiCookieAuth(ACCESS_COOKIE)
@ApiErrors(401, 403, 429)
@Roles(...ROLES)
@Controller()
export class ResourcesController {
  constructor(private readonly data: JsonDataAccessor) {}

  @Get("patients")
  @ApiOkResponse(list)
  patients(): JsonObject[] {
    return this.data.patients();
  }

  @Get("psychologists")
  @ApiOkResponse(list)
  psychologists(): JsonObject[] {
    return this.data.psychologists();
  }

  @Get("assignments")
  @ApiOkResponse(list)
  assignments(): JsonObject[] {
    return this.data.assignments();
  }
}
