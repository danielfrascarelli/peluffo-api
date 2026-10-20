import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard } from "@nestjs/throttler";
import { AuthGuard } from "@/common/auth.guard";
import { TokenService } from "@/common/token.service";

// Guard order matters: throttle before authenticating, so failed logins still count.
@Module({
  imports: [JwtModule.register({})],
  providers: [
    TokenService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [TokenService],
})
export class SecurityModule {}
