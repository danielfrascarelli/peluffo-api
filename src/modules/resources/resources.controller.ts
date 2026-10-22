import { Controller, Get } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ApiErrors } from "@/common/api-errors.decorator";
import { ROLES, Roles } from "@/common/auth.decorator";
import { ACCESS_COOKIE } from "@/common/token.service";
import { JsonDataAccessor } from "@/data/json-data.accessor";
import type { Patient, Psychologist, Assignment } from "@/data/resources.types";

// Resource shapes are defined in data/resources.types.ts; the frontend migration is separate.
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
  patients(): Patient[] {
    return this.data.patients();
  }

  @Get("psychologists")
  @ApiOkResponse(list)
  psychologists(): Psychologist[] {
    return this.data.psychologists();
  }

  @Get("assignments")
  @ApiOkResponse(list)
  assignments(): Assignment[] {
    return this.data.assignments();
  }
}
