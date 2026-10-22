import { ApiProperty } from "@nestjs/swagger";

export class ExtractionIssuePatientDto {
  @ApiProperty() fullName!: string;
  @ApiProperty() cedula!: string;
}
