import { ApiProperty } from "@nestjs/swagger";

export class StatisticsSummaryDto {
  @ApiProperty({ description: "Accumulated patients whose latest valid status is assigned.", minimum: 0 })
  activePatients!: number;
  @ApiProperty({ minimum: 0 }) waitingPatients!: number;
  @ApiProperty({
    description:
      "Distinct patients assigned this local month, including historical assignments; future dates excluded.",
    minimum: 0,
  })
  assignedThisMonth!: number;
  @ApiProperty({ type: Number, nullable: true, example: null })
  finishedThisMonth!: null;
  @ApiProperty({ enum: ["TREATMENT_END_NOT_COLLECTED"] })
  finishedUnavailableReason!: "TREATMENT_END_NOT_COLLECTED";
}
