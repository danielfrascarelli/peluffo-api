import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import type { LoggerModuleAsyncParams } from "nestjs-pino";
import { EnvNames } from "@/common/config.options";

// The one list of sensitive fields. Add new ones here; every log line passes through it.
export const SENSITIVE_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'res.headers["set-cookie"]',
  "*.password",
  "*.passwordHash",
];

export const loggerOptions: LoggerModuleAsyncParams = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    pinoHttp: {
      level: config.getOrThrow<string>(EnvNames.LogLevel),
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      redact: { paths: SENSITIVE_PATHS, censor: "[redacted]" },
      transport: config.get<string>(EnvNames.NodeEnv) === "development" ? { target: "pino-pretty" } : undefined,
    },
  }),
};
