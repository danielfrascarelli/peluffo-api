import { ApiProperty } from "@nestjs/swagger";

export class ResourceCountsDto {
  @ApiProperty() patients!: number;
  @ApiProperty() psychologists!: number;
  @ApiProperty() assignments!: number;
}
