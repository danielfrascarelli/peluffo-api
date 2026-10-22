import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ExtractionIssuePatientDto } from "@/modules/data-extractions/dto/extraction-issue-patient.dto";
import { ExtractionIssueCellDto } from "@/modules/data-extractions/dto/extraction-issue-cell.dto";

export class ExtractionIssueContextDto {
  @ApiPropertyOptional({ type: ExtractionIssuePatientDto }) patient?: ExtractionIssuePatientDto;
  @ApiProperty({ type: [ExtractionIssueCellDto] }) cells!: ExtractionIssueCellDto[];
  @ApiPropertyOptional() normalizedCedula?: string;
  @ApiPropertyOptional({ type: [Number], description: "All rows sharing the duplicated cedula" })
  relatedRows?: number[];
  @ApiPropertyOptional() expectedSheet?: string;
  @ApiPropertyOptional() actualSheet?: string;
}
