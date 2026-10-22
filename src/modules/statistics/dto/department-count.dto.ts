import { ApiProperty } from "@nestjs/swagger";

export class DepartmentCountDto {
  @ApiProperty({ type: String, nullable: true, description: "Official department name; null means unresolved." })
  department!: string | null;
  @ApiProperty({ minimum: 0 }) count!: number;
}
