import "@/observability/process-handlers";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { EnvNames } from "@/common/config.options";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app);
  await app.listen(app.get(ConfigService).getOrThrow<number>(EnvNames.Port));
}

void bootstrap();
