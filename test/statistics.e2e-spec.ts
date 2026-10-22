import { copyFile, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import type { App } from "supertest/types";
import { EnvNames } from "@/common/config.options";
import { ExtractionSnapshotAccessor } from "@/data/extraction-snapshot.accessor";
import { JsonDataAccessor } from "@/data/json-data.accessor";
import { sheetFingerprint } from "@/data/sheet-fingerprint";
import { sheetFixture } from "@/modules/data-extractions/sheet.fixture";
import { mapSheet } from "@/modules/data-extractions/sheet.mapper";
import { cookiesOf, createApp } from "./app.harness";

describe("statistics HTTP boundary", () => {
  let directory: string;
  let app: NestExpressApplication;
  let server: App;
  let extractionId: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "peluffo-statistics-"));
    await copyFile("data/users.json", join(directory, "users.json"));
    const snapshots = new ExtractionSnapshotAccessor(new ConfigService({ [EnvNames.DataDir]: directory }));
    const source = sheetFixture();
    const extraction = mapSheet(source);
    // Reproduce a legacy snapshot; migration must be in memory only.
    delete extraction.resources.patients[0]!.ageRecordedAt;
    extractionId = await snapshots.save(source, extraction, extraction.resources);
    await snapshots.publish({ extractionId, lastExtractionId: extractionId, sourceHash: sheetFingerprint(source) });
    app = await createApp(directory);
    server = app.getHttpServer();
  });

  afterEach(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });

  async function access(username = "fibras", password = "fibras"): Promise<string> {
    const response = await request(server).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return cookiesOf(response)["__Host-access_token"]!.pair;
  }

  it("requires authentication, allows Peluffo/Fibras, and denies Colibri", async () => {
    await request(server).get("/api/v1/statistics").expect(401);
    for (const [username, password] of [
      ["fibras", "fibras"],
      ["colaborador.peluffo", "pass123"],
    ]) {
      const cookie = await access(username, password);
      await request(server).get("/api/v1/statistics").set("Cookie", cookie).expect(200);
    }
    const cookie = await access("colaborador.colibri", "pass123");
    const response = await request(server).get("/api/v1/statistics").set("Cookie", cookie).expect(403);
    expect(response.body).toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });

  it("restores verified legacy age references without rewriting snapshots and serves aggregates only", async () => {
    const cookie = await access();
    const storedPath = join(directory, extractionId, "processed", "patients.json");
    const stored = await readFile(storedPath, "utf8");
    expect(stored).not.toContain("ageRecordedAt");
    expect(app.get(JsonDataAccessor).patients()[0]?.ageRecordedAt).toBe("2026-10-21T17:30:00.000Z");
    const entries = (await readdir(directory, { recursive: true })).sort();
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request(server).get("/api/v1/statistics").set("Cookie", cookie).expect(200);
      expect(response.body).toMatchObject({
        timeZone: "America/Montevideo",
        totalPatients: 1,
        summary: { activePatients: 1, waitingPatients: 0, finishedThisMonth: null },
        sexDistribution: { available: false, data: [], missingCount: 1 },
        departmentDistribution: { data: [{ department: "Montevideo", count: 1 }] },
      });
      expect(JSON.stringify(response.body)).not.toMatch(/Ana|45678901|ana@example|Testing diagnosis/);
    }
    expect(await readFile(storedPath, "utf8")).toBe(stored);
    expect((await readdir(directory, { recursive: true })).sort()).toEqual(entries);
  });
});
