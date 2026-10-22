import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigService } from "@nestjs/config";
import { ErrorCode } from "@/common/errors";
import type { SheetCapture } from "@/data/extraction.types";
import { ExtractionSnapshotAccessor } from "@/data/extraction-snapshot.accessor";
import { GoogleSheetsAccessor } from "@/data/google-sheets.accessor";
import { JsonDataAccessor } from "@/data/json-data.accessor";
import { DataExtractionsService } from "@/modules/data-extractions/data-extractions.service";
import { sheetFixture } from "@/modules/data-extractions/sheet.fixture";

describe("data extraction persistence", () => {
  let directory: string;
  let config: ConfigService;
  let snapshots: ExtractionSnapshotAccessor;
  let sheets: GoogleSheetsAccessor;
  let data: JsonDataAccessor;
  let service: DataExtractionsService;
  let capture: jest.SpiedFunction<GoogleSheetsAccessor["capture"]>;

  beforeEach(async () => {
    directory = await fs.mkdtemp(join(tmpdir(), "peluffo-extraction-"));
    await fs.writeFile(join(directory, "users.json"), "[]");
    config = new ConfigService({ DATA_DIR: directory });
    snapshots = new ExtractionSnapshotAccessor(config);
    sheets = new GoogleSheetsAccessor(config);
    jest.spyOn(sheets, "configured", "get").mockReturnValue(true);
    capture = jest.spyOn(sheets, "capture").mockResolvedValue(sheetFixture());
    data = new JsonDataAccessor(config, snapshots);
    service = new DataExtractionsService(sheets, snapshots, data);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(directory, { recursive: true, force: true });
  });

  it("publishes complete snapshots, updates memory, and loads the same resources after restart", async () => {
    const source = sheetFixture();
    const result = await service.extract();
    expect(result).toMatchObject({
      applied: true,
      counts: { extracted: { patients: 1, psychologists: 1, assignments: 1 } },
      warnings: 0,
      errors: 0,
    });
    const path = join(directory, result.path);
    expect(JSON.parse(await fs.readFile(join(path, "source.json"), "utf8"))).toEqual(source);
    expect(JSON.parse(await fs.readFile(join(path, "report.json"), "utf8"))).toEqual({ warnings: [], errors: [] });
    expect(await snapshots.loadActive()).toEqual(data.current());
    const restarted = new JsonDataAccessor(config, new ExtractionSnapshotAccessor(config));
    await restarted.onModuleInit();
    expect(restarted.current()).toEqual(data.current());
    await expect(fs.readFile(join(directory, "patients.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("archives rejected rows without replacing active resources", async () => {
    const first = await service.extract();
    capture.mockResolvedValue(sheetFixture([{}, {}], "2026-10-22T17:38:00.123Z"));
    const result = await service.extract();
    expect(result.applied).toBe(false);
    expect(result.errors).toBe(2);
    expect(result.counts.extracted.patients).toBe(0);
    expect(result.counts.processed.patients).toBe(1);
    expect(JSON.parse(await fs.readFile(join(directory, "current.json"), "utf8"))).toMatchObject({
      extractionId: first.extractionId,
      lastExtractionId: result.extractionId,
    });
    await expect(fs.readFile(join(directory, result.path, "source.json"))).resolves.toBeDefined();
    await expect(fs.readFile(join(directory, result.path, "processed", "patients.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("archives empty captures without activating an empty dataset", async () => {
    capture.mockResolvedValue(sheetFixture([]));
    const result = await service.extract();
    expect(result.applied).toBe(false);
    expect(await snapshots.loadActive()).toEqual({ patients: [], psychologists: [], assignments: [] });
  });

  it("rejects simultaneous requests and releases the lock after finishing", async () => {
    let release!: (source: SheetCapture) => void;
    capture.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const first = service.extract();
    await expect(service.extract()).rejects.toMatchObject({ response: { code: ErrorCode.ExtractionInProgress } });
    release(sheetFixture());
    await first;
    capture.mockResolvedValue(sheetFixture([], "2026-10-22T17:38:00.123Z"));
    await expect(service.extract()).resolves.toMatchObject({ applied: false });
  });

  it("leaves active data unchanged after publication failure and releases the lock", async () => {
    const first = await service.extract();
    const previous = structuredClone(data.current());
    capture.mockResolvedValue(sheetFixture([{ city: "Salto" }], "2026-10-22T17:38:00.123Z"));
    const rename = fs.rename;
    const spy = jest.spyOn(fs, "rename").mockImplementation(async (from, to) => {
      if (String(to).endsWith("current.json")) throw new Error("Simulated reference publication failure");
      await rename(from, to);
    });
    await expect(service.extract()).rejects.toMatchObject({ response: { code: ErrorCode.Internal } });
    expect(data.current()).toEqual(previous);
    expect(await snapshots.loadActive()).toEqual(previous);
    expect(JSON.parse(await fs.readFile(join(directory, "current.json"), "utf8"))).toMatchObject({
      extractionId: first.extractionId,
      lastExtractionId: first.extractionId,
    });
    spy.mockRestore();
    capture.mockResolvedValue(sheetFixture([{ city: "Salto" }], "2026-10-23T17:38:00.123Z"));
    await expect(service.extract()).resolves.toMatchObject({ applied: true });
    expect(data.patients()[0]?.city).toBe("Salto");
  });

  it("does not activate partially written snapshots or let cleanup mask the original error", async () => {
    await service.extract();
    const previous = structuredClone(data.current());
    capture.mockResolvedValue(sheetFixture([{ city: "Salto" }], "2026-10-22T17:38:00.123Z"));
    const write = fs.writeFile;
    jest.spyOn(fs, "writeFile").mockImplementation(async (path, contents, options) => {
      if (typeof path === "string" && path.endsWith("psychologists.json")) throw new Error("Simulated write failure");
      await write(path, contents, options);
    });
    jest.spyOn(fs, "rm").mockRejectedValue(new Error("Simulated cleanup failure"));
    await expect(service.extract()).rejects.toMatchObject({ response: { code: ErrorCode.Internal } });
    expect(data.current()).toEqual(previous);
    expect(await snapshots.loadActive()).toEqual(previous);
    await expect(fs.readFile(join(directory, "2026-10-22T17-38-00.123Z", "source.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("successful publication does not depend on deleting backups or temporary files", async () => {
    jest.spyOn(fs, "rm").mockRejectedValue(new Error("Cleanup unavailable"));
    await expect(service.extract()).resolves.toMatchObject({ applied: true });
    expect(data.patients()).toHaveLength(1);
    expect(await snapshots.loadActive()).toEqual(data.current());
  });

  it("fails startup on corrupt references or missing snapshot resources", async () => {
    await fs.writeFile(join(directory, "current.json"), JSON.stringify({ extractionId: "../outside" }));
    await expect(snapshots.loadActive()).rejects.toThrow("Invalid active extraction reference");
    await fs.writeFile(join(directory, "current.json"), JSON.stringify({ extractionId: "2026-10-22T17-38-00.123Z" }));
    await expect(snapshots.loadActive()).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("returns a sanitized upstream failure without persisting a snapshot, then allows a retry", async () => {
    capture.mockRejectedValueOnce(new Error("Upstream payload with sensitive values"));
    await expect(service.extract()).rejects.toMatchObject({
      response: {
        code: ErrorCode.DependencyUnavailable,
        message: "googleSheets: extraction failed",
      },
    });
    expect(await fs.readdir(directory)).toEqual(["users.json"]);
    await expect(service.extract()).resolves.toMatchObject({ applied: true });
  });

  it("returns unchanged without writes or replacing memory, while repeating full diagnostics", async () => {
    const source = sheetFixture([{ cedula: "12345678", age: "unknown" }, {}, {}]);
    capture.mockResolvedValue(source);
    const first = await service.extract();
    expect(first).toMatchObject({ changed: true, warnings: 1, errors: 2 });
    const previous = data.current();
    const manifest = await fs.readFile(join(directory, "current.json"), "utf8");
    const files = await fs.readdir(directory);
    const write = jest.spyOn(fs, "writeFile");
    const rename = jest.spyOn(fs, "rename");
    const mkdir = jest.spyOn(fs, "mkdir");
    const secondSource = { ...source, capturedAt: "2026-10-22T17:38:00.123Z" };
    capture.mockResolvedValue(secondSource);
    const second = await service.extract();
    expect(second).toMatchObject({
      changed: false,
      applied: false,
      checkedAt: secondSource.capturedAt,
      extractionId: first.extractionId,
    });
    expect(second.report).toEqual(first.report);
    expect(second.report.warnings).toHaveLength(1);
    expect(second.report.errors).toHaveLength(2);
    expect(data.current()).toBe(previous);
    expect(write).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
    expect(await fs.readFile(join(directory, "current.json"), "utf8")).toBe(manifest);
    expect(await fs.readdir(directory)).toEqual(files);
  });

  it.each(["empty", "invalid"])(
    "deduplicates %s captures after restart even without active resources",
    async (kind) => {
      const source = sheetFixture(kind === "empty" ? [] : [{}, {}]);
      capture.mockResolvedValue(source);
      const first = await service.extract();
      expect(first.applied).toBe(false);
      const restartedData = new JsonDataAccessor(config, new ExtractionSnapshotAccessor(config));
      await restartedData.onModuleInit();
      const restarted = new DataExtractionsService(sheets, new ExtractionSnapshotAccessor(config), restartedData);
      capture.mockResolvedValue({ ...source, capturedAt: "2026-10-22T17:38:00.123Z" });
      const result = await restarted.extract();
      expect(result).toMatchObject({ changed: false, applied: false, extractionId: first.extractionId });
      expect(result.report).toEqual(first.report);
      expect((await fs.readdir(directory)).filter((file) => /^\d{4}-/.test(file))).toHaveLength(1);
    },
  );

  it("loads legacy references without rewriting them on an unchanged call", async () => {
    const first = await service.extract();
    const legacy = JSON.stringify({ extractionId: first.extractionId });
    await fs.writeFile(join(directory, "current.json"), legacy);
    const restartedData = new JsonDataAccessor(config, new ExtractionSnapshotAccessor(config));
    await restartedData.onModuleInit();
    const restarted = new DataExtractionsService(sheets, new ExtractionSnapshotAccessor(config), restartedData);
    const write = jest.spyOn(fs, "writeFile");
    capture.mockResolvedValue(sheetFixture([{}], "2026-10-22T17:38:00.123Z"));
    await expect(restarted.extract()).resolves.toMatchObject({ changed: false, extractionId: first.extractionId });
    expect(write).not.toHaveBeenCalled();
    expect(await fs.readFile(join(directory, "current.json"), "utf8")).toBe(legacy);
  });

  it("fails explicitly if stored captures are corrupt or their fingerprint mismatches", async () => {
    const first = await service.extract();
    const file = join(directory, first.extractionId, "source.json");
    await fs.writeFile(file, JSON.stringify(sheetFixture([{ city: "Modified outside the service" }])));
    await expect(snapshots.loadState()).rejects.toThrow("Stored Sheet fingerprint mismatch");
    await fs.writeFile(file, JSON.stringify({ rows: [] }));
    await expect(snapshots.loadState()).rejects.toThrow("Invalid stored Sheet capture");
  });

  it("returns richer current diagnostics without rewriting an older archived report", async () => {
    const source = sheetFixture([{ assignedAt: "" }]);
    capture.mockResolvedValue(source);
    const first = await service.extract();
    const reportFile = join(directory, first.path, "report.json");
    const legacyReport = JSON.stringify({
      warnings: [
        {
          row: 2,
          field: "assignment",
          code: "INVALID_ASSIGNMENT",
          message: "A valid date and psychologist are both required",
        },
      ],
      errors: [],
    });
    await fs.writeFile(reportFile, legacyReport);
    const write = jest.spyOn(fs, "writeFile");
    capture.mockResolvedValue({ ...source, capturedAt: "2026-10-22T17:38:00.123Z" });
    const current = await service.extract();
    expect(current.changed).toBe(false);
    expect(current.report.warnings[0]?.context).toMatchObject({
      patient: { fullName: "Ana Pérez", cedula: "4.567.890-1" },
      cells: [
        { column: "Q", value: "" },
        { column: "R", value: "Dra. López" },
      ],
    });
    expect(write).not.toHaveBeenCalled();
    expect(await fs.readFile(reportFile, "utf8")).toBe(legacyReport);
  });
});
