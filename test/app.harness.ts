import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Response } from "supertest";
import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";

export async function createApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();
  return app;
}

// "name=value" pairs from Set-Cookie, keyed by name. The cookies are Secure, so supertest's jar would drop them over http.
export function cookiesOf(res: Response): Record<string, { pair: string; raw: string }> {
  const header = res.headers["set-cookie"] as unknown as string[] | undefined;
  return Object.fromEntries(
    (header ?? []).map((raw) => {
      const pair = raw.split(";")[0]!;
      return [pair.split("=")[0]!, { pair, raw }];
    }),
  );
}
