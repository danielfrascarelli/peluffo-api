import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { GoogleSheetsHealthIndicator } from "@/modules/health/google-sheets.health-indicator";
import { HealthController } from "@/modules/health/health.controller";

@Module({ imports: [TerminusModule], controllers: [HealthController], providers: [GoogleSheetsHealthIndicator] })
export class HealthModule {}
