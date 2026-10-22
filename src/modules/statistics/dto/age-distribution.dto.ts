import { ApiProperty } from "@nestjs/swagger";
import { CountBucketDto } from "@/modules/statistics/dto/count-bucket.dto";

export class AgeDistributionDto {
  @ApiProperty({ enum: ["estimated"] }) basis!: "estimated";
  @ApiProperty({ example: "2026-10" }) asOfMonth!: string;
  @ApiProperty({
    type: [CountBucketDto],
    description:
      "Keys: le18, 19_25, 26_35, 36_50, gt50; zero buckets included. Declared age plus whole elapsed twelve-month periods.",
  })
  data!: CountBucketDto[];
  @ApiProperty({
    minimum: 0,
    description: "Missing age, missing reliable reference, or reference month after asOfMonth.",
  })
  missingCount!: number;
}
