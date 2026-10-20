import { applyDecorators } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";
import { ErrorBodyDto } from "@/common/dto/error-body.dto";

export const ApiErrors = (...statuses: number[]): MethodDecorator & ClassDecorator =>
  applyDecorators(...statuses.map((status) => ApiResponse({ status, type: ErrorBodyDto })));
