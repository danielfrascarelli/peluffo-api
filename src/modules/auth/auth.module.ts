import { Module } from "@nestjs/common";
import { SecurityModule } from "@/common/security.module";
import { AuthController } from "@/modules/auth/auth.controller";
import { AuthService } from "@/modules/auth/auth.service";

@Module({
  imports: [SecurityModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
