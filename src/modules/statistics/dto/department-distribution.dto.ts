import { ApiProperty } from "@nestjs/swagger";
import { DepartmentCountDto } from "@/modules/statistics/dto/department-count.dto";

export class DepartmentDistributionDto {
  @ApiProperty({ enum: ["derived_from_city"] }) basis!: "derived_from_city";
  @ApiProperty({
    type: [DepartmentCountDto],
    description: "Positive counts descending, department name breaks ties; unresolved null bucket last.",
  })
  data!: DepartmentCountDto[];
  @ApiProperty({ minimum: 0 }) unresolvedCount!: number;
}
