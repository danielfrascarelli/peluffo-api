import { ApiProperty } from "@nestjs/swagger";
import { MonthTotalDto } from "@/modules/statistics/dto/month-total.dto";

export class CumulativePatientsDto {
  @ApiProperty({
    type: [MonthTotalDto],
    description: "Twelve chronological cumulative buckets; older requests carried forward, future requests excluded.",
  })
  data!: MonthTotalDto[];
  @ApiProperty({ minimum: 0 }) missingDateCount!: number;
  @ApiProperty({ minimum: 0 }) futureDateCount!: number;
}
