import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AllExceptionsFilter } from "@/common/all-exceptions.filter";
import { API_PREFIX, API_VERSION, EnvNames } from "@/common/config.options";
import { AppException, ErrorCode } from "@/common/errors";
import { ACCESS_COOKIE } from "@/common/token.service";

// Shared by main.ts and the e2e harness so tests run the production bootstrap.
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);

  app.useLogger(app.get(Logger));
  app.set("trust proxy", config.getOrThrow<number | string>(EnvNames.TrustProxy));
  app.use(helmet(), compression(), cookieParser());
  app.useBodyParser("json", { limit: "10kb" });
  app.enableCors({
    origin: config
      .getOrThrow<string>(EnvNames.CorsOrigins)
      .split(",")
      .map((o) => o.trim()),
    credentials: true,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_VERSION });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new AppException(
          ErrorCode.ValidationFailed,
          errors.flatMap((e) => Object.values(e.constraints ?? {})).join("; "),
        ),
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (config.getOrThrow<boolean>(EnvNames.SwaggerEnabled)) {
    const document = new DocumentBuilder()
      .setTitle("Peluffo API")
      .setVersion(API_VERSION)
      .addCookieAuth(ACCESS_COOKIE)
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, document));
  }
}
