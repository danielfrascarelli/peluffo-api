import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { type Role, ROLES } from "@/common/auth.decorator";

export class UserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ enum: ROLES })
  role!: Role;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  phone!: string;

  @ApiPropertyOptional()
  avatarUrl?: string;
}
