import { ApiProperty } from "@nestjs/swagger";
import { ResourceCountsDto } from "@/modules/data-extractions/dto/resource-counts.dto";

export class ExtractionCountsDto {
  @ApiProperty({ type: ResourceCountsDto }) extracted!: ResourceCountsDto;
  @ApiProperty({ type: ResourceCountsDto }) processed!: ResourceCountsDto;
}
