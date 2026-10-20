import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { configOptions } from "@/common/config.options";
import { loggerOptions } from "@/common/logger.options";
import { SecurityModule } from "@/common/security.module";
import { throttlerOptions } from "@/common/throttler.options";
import { DataModule } from "@/data/data.module";
import { AuthModule } from "@/modules/auth/auth.module";
import { HealthModule } from "@/modules/health/health.module";
import { ResourcesModule } from "@/modules/resources/resources.module";

@Module({
  imports: [
    ConfigModule.forRoot(configOptions),
    LoggerModule.forRootAsync(loggerOptions),
    ThrottlerModule.forRoot(throttlerOptions),
    DataModule,
    SecurityModule,
    AuthModule,
    ResourcesModule,
    HealthModule,
  ],
})
export class AppModule {}
