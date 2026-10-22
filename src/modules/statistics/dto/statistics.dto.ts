import { ApiProperty } from "@nestjs/swagger";
import { StatisticsSummaryDto } from "@/modules/statistics/dto/statistics-summary.dto";
import { CumulativePatientsDto } from "@/modules/statistics/dto/cumulative-patients.dto";
import { AgeDistributionDto } from "@/modules/statistics/dto/age-distribution.dto";
import { SexDistributionDto } from "@/modules/statistics/dto/sex-distribution.dto";
import { DepartmentDistributionDto } from "@/modules/statistics/dto/department-distribution.dto";

export class StatisticsDto {
  @ApiProperty({ format: "date-time" }) generatedAt!: string;
  @ApiProperty({ enum: ["America/Montevideo"] }) timeZone!: string;
  @ApiProperty({ example: "2026-10" }) month!: string;
  @ApiProperty({
    minimum: 0,
    description: "Unique accumulated processed patients, including patients absent from the current Sheet.",
  })
  totalPatients!: number;
  @ApiProperty({ type: StatisticsSummaryDto }) summary!: StatisticsSummaryDto;
  @ApiProperty({ type: CumulativePatientsDto }) cumulativePatients!: CumulativePatientsDto;
  @ApiProperty({ type: AgeDistributionDto }) ageDistribution!: AgeDistributionDto;
  @ApiProperty({ type: SexDistributionDto }) sexDistribution!: SexDistributionDto;
  @ApiProperty({ type: DepartmentDistributionDto }) departmentDistribution!: DepartmentDistributionDto;
}
