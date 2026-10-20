import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from "@nestjs/common";
import type { Response } from "express";
import { AppException, ErrorCode, toErrorBody } from "@/common/errors";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    let body = toErrorBody(exception);
    if (!body) {
      this.logger.error(exception);
      body = toErrorBody(new AppException(ErrorCode.Internal))!;
    }
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
