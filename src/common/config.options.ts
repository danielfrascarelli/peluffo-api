import type { ConfigModuleOptions } from "@nestjs/config";
import Joi from "joi";

export const API_PREFIX = "api";
export const API_VERSION = "1";

export const EnvNames = {
  NodeEnv: "NODE_ENV",
  Port: "PORT",
  LogLevel: "LOG_LEVEL",
  CorsOrigins: "CORS_ORIGINS",
  TrustProxy: "TRUST_PROXY",
  JwtAccessSecret: "JWT_ACCESS_SECRET",
  JwtRefreshSecret: "JWT_REFRESH_SECRET",
  JwtAccessTtl: "JWT_ACCESS_TTL",
  JwtRefreshTtl: "JWT_REFRESH_TTL",
  DataDir: "DATA_DIR",
  SwaggerEnabled: "SWAGGER_ENABLED",
  GoogleCredentials: "GOOGLE_APPLICATION_CREDENTIALS",
  GoogleSheetId: "GOOGLE_SHEET_ID",
} as const;

const envSchema = Joi.object({
  [EnvNames.NodeEnv]: Joi.string().valid("development", "production", "test").default("development"),
  [EnvNames.Port]: Joi.number().port().default(3000),
  [EnvNames.LogLevel]: Joi.string().valid("fatal", "error", "warn", "info", "debug", "trace", "silent").default("info"),
  [EnvNames.CorsOrigins]: Joi.string().required(),
  // A number is a hop count; a string is "loopback" or a subnet list (Express "trust proxy").
  [EnvNames.TrustProxy]: Joi.alternatives(Joi.number().integer().min(0), Joi.string()).default("loopback"),
  [EnvNames.JwtAccessSecret]: Joi.string().min(32).required(),
  [EnvNames.JwtRefreshSecret]: Joi.string().min(32).invalid(Joi.ref(EnvNames.JwtAccessSecret)).required(),
  [EnvNames.JwtAccessTtl]: Joi.number().integer().min(60).default(900),
  [EnvNames.JwtRefreshTtl]: Joi.number().integer().min(300).default(604800),
  [EnvNames.DataDir]: Joi.string().default("data"),
  [EnvNames.SwaggerEnabled]: Joi.boolean().default(false),
  // Optional integration: empty or unset leaves Google Sheets unconfigured.
  [EnvNames.GoogleCredentials]: Joi.string().allow(""),
  [EnvNames.GoogleSheetId]: Joi.string().allow(""),
});

export const configOptions: ConfigModuleOptions = {
  isGlobal: true,
  validationSchema: envSchema,
  validationOptions: { abortEarly: false },
};
