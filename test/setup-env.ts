// Runs before any test module loads: ConfigModule.forRoot validates the environment at import time.
// Explicit values for every variable, so an ambient .env never leaks into tests.
Object.assign(process.env, {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  CORS_ORIGINS: "http://localhost:5173",
  TRUST_PROXY: "loopback",
  JWT_ACCESS_SECRET: "test-access-secret-0123456789abcdef",
  JWT_REFRESH_SECRET: "test-refresh-secret-0123456789abcdef",
  JWT_ACCESS_TTL: "900",
  JWT_REFRESH_TTL: "604800",
  DATA_DIR: "data",
  SWAGGER_ENABLED: "false",
  // Empty, not unset: a set variable wins over .env, so tests never reach Google.
  GOOGLE_APPLICATION_CREDENTIALS: "",
  GOOGLE_SHEET_ID: "",
});
