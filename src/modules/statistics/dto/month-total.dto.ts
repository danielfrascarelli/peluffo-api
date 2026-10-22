import { ApiProperty } from "@nestjs/swagger";

export class MonthTotalDto {
  @ApiProperty({ example: "2026-10" }) month!: string;
  @ApiProperty({ minimum: 0 }) total!: number;
}
