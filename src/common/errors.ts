import { HttpException, type HttpExceptionOptions } from "@nestjs/common";

export enum ErrorCode {
  ValidationFailed = "VALIDATION_FAILED",
  BadRequest = "BAD_REQUEST",
  Unauthenticated = "UNAUTHENTICATED",
  InvalidCredentials = "INVALID_CREDENTIALS",
  Forbidden = "FORBIDDEN",
  NotFound = "NOT_FOUND",
  PayloadTooLarge = "PAYLOAD_TOO_LARGE",
  RateLimited = "RATE_LIMITED",
  Internal = "INTERNAL",
  DependencyUnavailable = "DEPENDENCY_UNAVAILABLE",
}

export const errorStatus: Record<ErrorCode, number> = {
  [ErrorCode.ValidationFailed]: 400,
  [ErrorCode.BadRequest]: 400,
  [ErrorCode.Unauthenticated]: 401,
  [ErrorCode.InvalidCredentials]: 401,
  [ErrorCode.Forbidden]: 403,
  [ErrorCode.NotFound]: 404,
  [ErrorCode.PayloadTooLarge]: 413,
  [ErrorCode.RateLimited]: 429,
  [ErrorCode.Internal]: 500,
  [ErrorCode.DependencyUnavailable]: 503,
};

const defaultMessage: Record<ErrorCode, string> = {
  [ErrorCode.ValidationFailed]: "Validation failed",
  [ErrorCode.BadRequest]: "Bad request",
  [ErrorCode.Unauthenticated]: "Authentication required",
  [ErrorCode.InvalidCredentials]: "Invalid username or password",
  [ErrorCode.Forbidden]: "Forbidden",
  [ErrorCode.NotFound]: "Not found",
  [ErrorCode.PayloadTooLarge]: "Payload too large",
  [ErrorCode.RateLimited]: "Too many requests",
  [ErrorCode.Internal]: "Internal server error",
  [ErrorCode.DependencyUnavailable]: "A dependency is unavailable",
};

export interface ErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
}

export class AppException extends HttpException {
  constructor(code: ErrorCode, message = defaultMessage[code], options?: HttpExceptionOptions) {
    const body: ErrorBody = { statusCode: errorStatus[code], code, message };
    super(body, body.statusCode, options);
  }
}

// Framework and middleware errors (unknown route, throttler, body parser) carry only a status.
const codeByStatus: Partial<Record<number, ErrorCode>> = {
  401: ErrorCode.Unauthenticated,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  413: ErrorCode.PayloadTooLarge,
  429: ErrorCode.RateLimited,
};

export function toErrorBody(exception: unknown): ErrorBody | undefined {
  if (exception instanceof AppException) return exception.getResponse() as ErrorBody;
  const status = exception instanceof HttpException ? exception.getStatus() : clientErrorStatus(exception);
  if (status === undefined || status >= 500) return undefined;
  const code = codeByStatus[status] ?? ErrorCode.BadRequest;
  return { statusCode: errorStatus[code], code, message: defaultMessage[code] };
}

// body-parser throws http-errors objects, not HttpException.
function clientErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== "object" || exception === null || !("status" in exception)) return undefined;
  const { status } = exception;
  return typeof status === "number" && status >= 400 && status < 500 ? status : undefined;
}
