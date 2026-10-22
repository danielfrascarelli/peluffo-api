import { ApiProperty } from "@nestjs/swagger";

export class CountBucketDto {
  @ApiProperty({ description: "Stable chart bucket key." }) key!: string;
  @ApiProperty({ minimum: 0 }) count!: number;
}
