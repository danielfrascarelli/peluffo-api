import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "fibras" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username!: string;

  @ApiProperty({ example: "fibras", format: "password" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;
}
