import { ApiProperty } from "@nestjs/swagger";
import { CountBucketDto } from "@/modules/statistics/dto/count-bucket.dto";

export class SexDistributionDto {
  @ApiProperty({ enum: [false] }) available!: false;
  @ApiProperty({ enum: ["SEX_NOT_COLLECTED"] }) reason!: "SEX_NOT_COLLECTED";
  @ApiProperty({ type: [CountBucketDto], description: "Empty until this field is collected." }) data!: CountBucketDto[];
  @ApiProperty({ minimum: 0 }) missingCount!: number;
}
