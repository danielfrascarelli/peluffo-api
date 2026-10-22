import { ApiProperty } from "@nestjs/swagger";
import { ExtractionCountsDto } from "@/modules/data-extractions/dto/extraction-counts.dto";
import { ExtractionReportDto } from "@/modules/data-extractions/dto/extraction-report.dto";

export class DataExtractionResultDto {
  @ApiProperty() extractionId!: string;
  @ApiProperty({ description: "Snapshot path relative to DATA_DIR" }) path!: string;
  @ApiProperty({ description: "Report path relative to DATA_DIR" }) reportPath!: string;
  @ApiProperty() applied!: boolean;
  @ApiProperty() changed!: boolean;
  @ApiProperty({ format: "date-time" }) checkedAt!: string;
  @ApiProperty({ type: ExtractionCountsDto }) counts!: ExtractionCountsDto;
  @ApiProperty() warnings!: number;
  @ApiProperty() errors!: number;
  @ApiProperty({ type: ExtractionReportDto }) report!: ExtractionReportDto;
}
