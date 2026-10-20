import { ApiProperty } from "@nestjs/swagger";
import { ErrorCode, type ErrorBody } from "@/common/errors";

export class ErrorBodyDto implements ErrorBody {
  @ApiProperty({ example: 401 })
  statusCode!: number;

  @ApiProperty({ enum: ErrorCode, example: ErrorCode.Unauthenticated })
  code!: ErrorCode;

  @ApiProperty({ example: "Authentication required" })
  message!: string;
}
