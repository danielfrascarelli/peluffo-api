import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import type { SheetCapture } from "@/data/extraction.types";
import { GoogleSheetsAccessor } from "@/data/google-sheets.accessor";
import { sheetFixture } from "@/modules/data-extractions/sheet.fixture";
import { createApp, cookiesOf } from "./app.harness";

describe("extraction HTTP boundary", () => {
  let directory: string;
  let app: NestExpressApplication;
  let access: string;
  let capture: jest.SpiedFunction<GoogleSheetsAccessor["capture"]>;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "peluffo-http-"));
    await copyFile("data/users.json", join(directory, "users.json"));
    app = await createApp(directory);
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username: "fibras", password: "fibras" })
      .expect(200);
    access = cookiesOf(response)["__Host-access_token"]!.pair;
    jest.spyOn(app.get(GoogleSheetsAccessor), "configured", "get").mockReturnValue(true);
    capture = jest.spyOn(app.get(GoogleSheetsAccessor), "capture").mockResolvedValue(sheetFixture());
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("serves processed resources immediately, accumulates absent patients, and preserves state across restart", async () => {
    const extract = () => request(app.getHttpServer()).post("/api/v1/data/extractions").set("Cookie", access);
    const first = await extract().expect(201);
    expect(first.body).toMatchObject({ changed: true, applied: true, counts: { extracted: { patients: 1 } } });
    capture.mockResolvedValue(sheetFixture([{}], "2026-10-22T16:38:00.123Z"));
    const unchanged = await extract().expect(200);
    expect(unchanged.body).toMatchObject({
      changed: false,
      applied: false,
      checkedAt: "2026-10-22T16:38:00.123Z",
      report: { warnings: [], errors: [] },
    });
    const patients = await request(app.getHttpServer()).get("/api/v1/patients").set("Cookie", access).expect(200);
    expect(patients.body).toEqual([expect.objectContaining({ fullName: "Ana Pérez", assignmentStatus: "assigned" })]);
    capture.mockResolvedValue(
      sheetFixture(
        [{ cedula: "12345678", fullName: "New Patient", assignedAt: "", psychologist: "", age: "unknown" }],
        "2026-10-22T17:38:00.123Z",
      ),
    );
    const second = await extract().expect(201);
    expect(second.body).toMatchObject({
      warnings: 1,
      counts: { extracted: { patients: 1 }, processed: { patients: 2 } },
    });
    expect(
      JSON.parse(await readFile(join(directory, "2026-10-22T17-38-00.123Z", "extracted", "patients.json"), "utf8")),
    ).toEqual([expect.objectContaining({ fullName: "New Patient", assignmentStatus: "pending" })]);
    await app.close();
    app = await createApp(directory);
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username: "fibras", password: "fibras" })
      .expect(200);
    const cookie = cookiesOf(login)["__Host-access_token"]!.pair;
    const restarted = await request(app.getHttpServer()).get("/api/v1/patients").set("Cookie", cookie).expect(200);
    expect(restarted.body).toHaveLength(2);
    jest.spyOn(app.get(GoogleSheetsAccessor), "configured", "get").mockReturnValue(true);
    jest
      .spyOn(app.get(GoogleSheetsAccessor), "capture")
      .mockResolvedValue(
        sheetFixture(
          [{ cedula: "12345678", fullName: "New Patient", assignedAt: "", psychologist: "", age: "unknown" }],
          "2026-10-23T17:38:00.123Z",
        ),
      );
    const afterRestart = await request(app.getHttpServer())
      .post("/api/v1/data/extractions")
      .set("Cookie", cookie)
      .expect(200);
    expect(afterRestart.body).toMatchObject({ changed: false, applied: false, warnings: 1 });
  });

  it("repeats warnings and blocking row errors in unchanged HTTP responses", async () => {
    const source = sheetFixture([{ cedula: "12345678", age: "unknown" }, {}, {}]);
    capture.mockResolvedValue(source);
    const first = await request(app.getHttpServer()).post("/api/v1/data/extractions").set("Cookie", access).expect(201);
    capture.mockResolvedValue({ ...source, capturedAt: "2026-10-22T17:38:00.123Z" });
    const repeated = await request(app.getHttpServer())
      .post("/api/v1/data/extractions")
      .set("Cookie", access)
      .expect(200);
    expect(repeated.body).toMatchObject({ changed: false, applied: false, warnings: 1, errors: 2 });
    const report = (repeated.body as { report: { warnings: unknown[]; errors: unknown[] } }).report;
    expect(report.warnings).toHaveLength(1);
    expect(report.errors).toHaveLength(2);
    expect(report).toEqual((first.body as { report: unknown }).report);
    expect(report.warnings[0]).toMatchObject({
      context: {
        patient: { fullName: "Ana Pérez", cedula: "12345678" },
        cells: [{ column: "D", value: "unknown" }],
      },
    });
    expect(report.errors[0]).toMatchObject({
      context: {
        patient: { fullName: "Ana Pérez", cedula: "4.567.890-1" },
        normalizedCedula: "45678901",
        relatedRows: [3, 4],
        cells: [{ column: "F", value: "4.567.890-1" }],
      },
    });
  });

  it("responds 409 to a second extraction while the first is waiting on Sheets", async () => {
    let release!: (value: SheetCapture) => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    capture.mockImplementation(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const first = request(app.getHttpServer())
      .post("/api/v1/data/extractions")
      .set("Cookie", access)
      .then((response) => response);
    await entered;
    try {
      const second = await request(app.getHttpServer())
        .post("/api/v1/data/extractions")
        .set("Cookie", access)
        .expect(409);
      expect(second.body).toMatchObject({ code: "EXTRACTION_IN_PROGRESS" });
    } finally {
      release(sheetFixture());
      expect((await first).status).toBe(201);
    }
  });
});
