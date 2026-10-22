import { ApiProperty } from "@nestjs/swagger";
import { ExtractionIssueDto } from "@/modules/data-extractions/dto/extraction-issue.dto";

export class ExtractionReportDto {
  @ApiProperty({ type: [ExtractionIssueDto] }) warnings!: ExtractionIssueDto[];
  @ApiProperty({ type: [ExtractionIssueDto] }) errors!: ExtractionIssueDto[];
}
