import { ApiProperty } from "@nestjs/swagger";
import { ExtractionIssueContextDto } from "@/modules/data-extractions/dto/extraction-issue-context.dto";

export class ExtractionIssueDto {
  @ApiProperty() row!: number;
  @ApiProperty() field!: string;
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ type: ExtractionIssueContextDto }) context!: ExtractionIssueContextDto;
}
