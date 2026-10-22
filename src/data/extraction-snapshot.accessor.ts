import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Joi from "joi";
import { EnvNames } from "@/common/config.options";
import type { Extraction, ExtractionState, SheetCapture } from "@/data/extraction.types";
import { emptyResources, RESOURCE_NAMES, type Resources } from "@/data/resources.types";
import { validateResources } from "@/data/resources.schema";
import { validateSheetCapture } from "@/data/sheet-capture.schema";
import { sheetFingerprint } from "@/data/sheet-fingerprint";
import { restoreAgeReferences } from "@/data/patient-age";

const extractionIdPattern = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;
const manifestSchema = Joi.object({
  extractionId: Joi.string().pattern(extractionIdPattern),
  lastExtractionId: Joi.string().pattern(extractionIdPattern),
  sourceHash: Joi.string().pattern(/^[a-f0-9]{64}$/),
})
  .and("lastExtractionId", "sourceHash")
  .or("extractionId", "lastExtractionId")
  .required();

interface StoredManifest {
  extractionId?: string;
  lastExtractionId?: string;
  sourceHash?: string;
}

@Injectable()
export class ExtractionSnapshotAccessor {
  private readonly logger = new Logger(ExtractionSnapshotAccessor.name);

  constructor(private readonly config: ConfigService) {}

  private get directory(): string {
    return this.config.getOrThrow<string>(EnvNames.DataDir);
  }

  async loadActive(): Promise<Resources> {
    const state = await this.loadState();
    if (!state?.extractionId) return emptyResources();
    const [processed, extracted] = await Promise.all([
      this.readResources(state.extractionId, "processed"),
      this.readResources(state.extractionId, "extracted"),
    ]);
    return { ...processed, patients: restoreAgeReferences(processed.patients, extracted.patients) };
  }

  private async readResources(extractionId: string, kind: "processed" | "extracted"): Promise<Resources> {
    const entries = await Promise.all(
      RESOURCE_NAMES.map(async (name) => {
        const value: unknown = JSON.parse(
          await readFile(join(this.directory, extractionId, kind, `${name}.json`), "utf8"),
        );
        return [name, value];
      }),
    );
    return validateResources(Object.fromEntries(entries));
  }

  async loadState(): Promise<ExtractionState | undefined> {
    let manifest: string;
    try {
      manifest = await readFile(join(this.directory, "current.json"), "utf8");
    } catch (error) {
      if (hasCode(error, "ENOENT")) return undefined;
      throw error;
    }
    const parsed: unknown = JSON.parse(manifest);
    const validation = manifestSchema.validate(parsed, { convert: false });
    if (validation.error) throw new Error("Invalid active extraction reference");
    const stored = validation.value as StoredManifest;
    const lastExtractionId = stored.lastExtractionId ?? stored.extractionId!;
    const source: unknown = JSON.parse(await readFile(join(this.directory, lastExtractionId, "source.json"), "utf8"));
    const sourceHash = sheetFingerprint(validateSheetCapture(source));
    if (stored.sourceHash && sourceHash !== stored.sourceHash) throw new Error("Stored Sheet fingerprint mismatch");
    return { extractionId: stored.extractionId, lastExtractionId, sourceHash };
  }

  async save(source: SheetCapture, extraction: Extraction, processed?: Resources): Promise<string> {
    const extractionId = source.capturedAt.replace(/:/g, "-");
    if (!extractionIdPattern.test(extractionId)) throw new Error("Invalid extraction timestamp");
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = await mkdtemp(join(this.directory, ".extraction-"));
    try {
      await this.writeJson(join(temporary, "source.json"), source);
      await this.writeJson(join(temporary, "report.json"), extraction.report);
      await this.writeResources(join(temporary, "extracted"), extraction.resources);
      if (processed) await this.writeResources(join(temporary, "processed"), processed);
      await rename(temporary, join(this.directory, extractionId));
      return extractionId;
    } catch (error) {
      await this.cleanup(temporary);
      throw error;
    }
  }

  async publish(state: ExtractionState): Promise<void> {
    if (manifestSchema.validate(state, { convert: false }).error) throw new Error("Invalid extraction state");
    const temporary = join(this.directory, `.current-${randomUUID()}.json`);
    try {
      await this.writeJson(temporary, state);
      await rename(temporary, join(this.directory, "current.json"));
    } catch (error) {
      await this.cleanup(temporary);
      throw error;
    }
  }

  private async writeResources(directory: string, resources: Resources): Promise<void> {
    validateResources(resources);
    await mkdir(directory, { mode: 0o700 });
    // Finish every write before cleanup; Promise.all would leave writers running after its first rejection.
    const writes = await Promise.allSettled(
      RESOURCE_NAMES.map((name) => this.writeJson(join(directory, `${name}.json`), resources[name])),
    );
    for (const result of writes) if (result.status === "rejected") throw result.reason;
  }

  private async writeJson(path: string, value: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
      flush: true,
    });
  }

  private async cleanup(path: string): Promise<void> {
    try {
      await rm(path, { recursive: true, force: true });
    } catch {
      this.logger.warn("Extraction temporary files could not be removed");
    }
  }
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
