import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ExtractionIssueCellDto {
  @ApiProperty({ example: "Q" }) column!: string;
  @ApiProperty({ description: "Original displayed cell value, including invalid values" }) value!: string;
  @ApiPropertyOptional({ description: "Expected header prefix, for header errors" }) expected?: string;
}
