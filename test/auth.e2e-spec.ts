import type { NestExpressApplication } from "@nestjs/platform-express";
import request, { type Response } from "supertest";
import type { App } from "supertest/types";
import type { ErrorBody } from "@/common/errors";
import { cookiesOf, createApp } from "./app.harness";

const ACCESS = "__Host-access_token";
const REFRESH = "__Secure-refresh_token";
const api = (path: string): string => `/api/v1${path}`;
const errorOf = (res: Response): ErrorBody => res.body as ErrorBody;

describe("auth and resources", () => {
  let app: NestExpressApplication;
  let server: App;
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "peluffo-auth-"));
    await copyFile("data/users.json", join(directory, "users.json"));
    app = await createApp(directory);
    server = app.getHttpServer();
  });
  afterEach(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });

  const login = (username = "fibras", password = "fibras") =>
    request(server).post(api("/auth/login")).send({ username, password });

  it("rejects resource requests without an access cookie", async () => {
    const res = await request(server).get(api("/patients")).expect(401);
    expect(errorOf(res)).toMatchObject({ statusCode: 401, code: "UNAUTHENTICATED" });
  });

  it("rejects wrong credentials without setting cookies", async () => {
    const res = await login("fibras", "wrong").expect(401);
    expect(errorOf(res).code).toBe("INVALID_CREDENTIALS");
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(errorOf(await login("nobody", "x").expect(401)).code).toBe("INVALID_CREDENTIALS");
  });

  it("logs in with httpOnly cookies and never returns tokens or the password hash", async () => {
    const res = await login().expect(200);
    expect(res.body).toMatchObject({ id: "u3", username: "fibras", role: "fibras" });
    expect(JSON.stringify(res.body)).not.toMatch(/password|token|eyJ/i);

    const cookies = cookiesOf(res);
    expect(cookies[ACCESS]!.raw).toMatch(/Path=\/;.*HttpOnly; Secure; SameSite=Strict/);
    expect(cookies[REFRESH]!.raw).toMatch(/Path=\/api\/v1\/auth;.*HttpOnly; Secure; SameSite=Strict/);
  });

  it("serves every resource and the profile to a logged-in user", async () => {
    const access = cookiesOf(await login("colaborador.colibri", "pass123"))[ACCESS]!.pair;
    for (const name of ["patients", "psychologists", "assignments"]) {
      const res = await request(server)
        .get(api(`/${name}`))
        .set("Cookie", access)
        .expect(200);
      expect(res.body).toEqual([]);
    }
    const me = await request(server).get(api("/auth/me")).set("Cookie", access).expect(200);
    expect(me.body).toMatchObject({ username: "colaborador.colibri", role: "colibri" });
  });

  it("does not accept a refresh token as an access token", async () => {
    const refresh = cookiesOf(await login())[REFRESH]!.pair.replace(REFRESH, ACCESS);
    await request(server).get(api("/patients")).set("Cookie", refresh).expect(401);
  });

  it("rotates the refresh token and revokes the session when an old one is reused", async () => {
    const first = cookiesOf(await login())[REFRESH]!.pair;

    const rotated = await request(server).post(api("/auth/refresh")).set("Cookie", first).expect(204);
    const second = cookiesOf(rotated)[REFRESH]!.pair;
    expect(cookiesOf(rotated)[ACCESS]).toBeDefined();
    expect(second).not.toBe(first);

    await request(server).post(api("/auth/refresh")).set("Cookie", first).expect(401);
    // The reuse ended the session, so the legitimately rotated token is dead too.
    await request(server).post(api("/auth/refresh")).set("Cookie", second).expect(401);
  });

  it("revokes the session on logout", async () => {
    const refresh = cookiesOf(await login())[REFRESH]!.pair;
    const res = await request(server).post(api("/auth/logout")).set("Cookie", refresh).expect(204);
    expect(cookiesOf(res)[ACCESS]!.raw).toMatch(/Expires=Thu, 01 Jan 1970/);
    await request(server).post(api("/auth/refresh")).set("Cookie", refresh).expect(401);
  });

  it("rejects unknown and missing login fields with the uniform error body", async () => {
    const extra = await request(server)
      .post(api("/auth/login"))
      .send({ username: "fibras", password: "fibras", role: "fibras" })
      .expect(400);
    expect(errorOf(extra)).toMatchObject({ statusCode: 400, code: "VALIDATION_FAILED" });
    expect(errorOf(extra).message).toMatch(/role/);
    await request(server).post(api("/auth/login")).send({ username: "fibras" }).expect(400);
  });

  it("answers malformed JSON and unknown routes with the uniform error body", async () => {
    const bad = await request(server)
      .post(api("/auth/login"))
      .set("Content-Type", "application/json")
      .send("{oops")
      .expect(400);
    expect(bad.body).toEqual({ statusCode: 400, code: "BAD_REQUEST", message: "Bad request" });
    const missing = await request(server).get(api("/nope")).expect(404);
    expect(errorOf(missing).code).toBe("NOT_FOUND");
  });

  it("throttles repeated login attempts", async () => {
    for (let i = 0; i < 5; i++) await login("fibras", "wrong").expect(401);
    const res = await login("fibras", "wrong").expect(429);
    expect(errorOf(res).code).toBe("RATE_LIMITED");
  });

  it("keeps the dependencies check behind login and reports Google Sheets as unconfigured in tests", async () => {
    await request(server).get("/api/health/dependencies").expect(401);
    const access = cookiesOf(await login())[ACCESS]!.pair;
    const res = await request(server).get("/api/health/dependencies").set("Cookie", access).expect(503);
    expect(errorOf(res)).toEqual({
      statusCode: 503,
      code: "DEPENDENCY_UNAVAILABLE",
      message: "googleSheets: not configured",
    });
  });

  it("allows only fibras to start an extraction", async () => {
    await request(server).post(api("/data/extractions")).expect(401);
    const peluffo = cookiesOf(await login("colaborador.peluffo", "pass123"))[ACCESS]!.pair;
    await request(server).post(api("/data/extractions")).set("Cookie", peluffo).expect(403);
    const colibri = cookiesOf(await login("colaborador.colibri", "pass123"))[ACCESS]!.pair;
    await request(server).post(api("/data/extractions")).set("Cookie", colibri).expect(403);
    const fibras = cookiesOf(await login())[ACCESS]!.pair;
    const res = await request(server).post(api("/data/extractions")).set("Cookie", fibras).expect(503);
    expect(errorOf(res).code).toBe("DEPENDENCY_UNAVAILABLE");
  });

  it("exposes a public liveness probe outside the version prefix", async () => {
    const res = await request(server).get("/api/health/live").expect(200);
    expect(res.body).toEqual({ status: "ok", info: {}, error: {}, details: {} });
  });
});
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
