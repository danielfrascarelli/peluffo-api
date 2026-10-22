import { Injectable, Logger } from "@nestjs/common";
import { AppException, ErrorCode } from "@/common/errors";
import { ExtractionSnapshotAccessor } from "@/data/extraction-snapshot.accessor";
import { type DataExtractionResult, type Extraction, resourceCounts, type SheetCapture } from "@/data/extraction.types";
import { GoogleSheetsAccessor } from "@/data/google-sheets.accessor";
import { JsonDataAccessor } from "@/data/json-data.accessor";
import { processResources } from "@/modules/data-extractions/resources.processor";
import { SHEET_RANGE } from "@/modules/data-extractions/sheet-columns";
import { mapSheet } from "@/modules/data-extractions/sheet.mapper";
import { sheetFingerprint } from "@/data/sheet-fingerprint";

@Injectable()
export class DataExtractionsService {
  private readonly logger = new Logger(DataExtractionsService.name);
  private running = false;

  constructor(
    private readonly sheets: GoogleSheetsAccessor,
    private readonly snapshots: ExtractionSnapshotAccessor,
    private readonly data: JsonDataAccessor,
  ) {}

  async extract(): Promise<DataExtractionResult> {
    if (this.running) throw new AppException(ErrorCode.ExtractionInProgress);
    this.running = true;
    try {
      return await this.run();
    } finally {
      this.running = false;
    }
  }

  private async run(): Promise<DataExtractionResult> {
    const source = await this.capture();
    const extraction = mapSheet(source);
    const sourceHash = sheetFingerprint(source);
    try {
      const previous = await this.snapshots.loadState();
      if (previous?.sourceHash === sourceHash) {
        return this.result(source, extraction, { id: previous.lastExtractionId, changed: false, applied: false });
      }
      const processed = extraction.resources.patients.length
        ? processResources(this.data.current(), extraction.resources, source.capturedAt)
        : undefined;
      const extractionId = await this.snapshots.save(source, extraction, processed);
      await this.snapshots.publish({
        extractionId: processed ? extractionId : previous?.extractionId,
        lastExtractionId: extractionId,
        sourceHash,
      });
      if (processed) {
        this.data.replace(processed);
      }
      return this.result(source, extraction, { id: extractionId, changed: true, applied: processed !== undefined });
    } catch (error) {
      this.logger.error("Extraction snapshot could not be published");
      throw new AppException(ErrorCode.Internal, undefined, { cause: error });
    }
  }

  private result(
    source: SheetCapture,
    extraction: Extraction,
    snapshot: { id: string; changed: boolean; applied: boolean },
  ): DataExtractionResult {
    return {
      extractionId: snapshot.id,
      path: snapshot.id,
      reportPath: snapshot.id + "/report.json",
      checkedAt: source.capturedAt,
      changed: snapshot.changed,
      applied: snapshot.applied,
      counts: { extracted: resourceCounts(extraction.resources), processed: resourceCounts(this.data.current()) },
      warnings: extraction.report.warnings.length,
      errors: extraction.report.errors.length,
      report: extraction.report,
    };
  }

  private async capture(): Promise<SheetCapture> {
    if (!this.sheets.configured)
      throw new AppException(ErrorCode.DependencyUnavailable, "googleSheets: not configured");
    try {
      return await this.sheets.capture(SHEET_RANGE);
    } catch {
      // Upstream errors can carry authorization headers and cell data; do not log their payloads or causes.
      this.logger.error("Google Sheets capture failed");
      throw new AppException(ErrorCode.DependencyUnavailable, "googleSheets: extraction failed");
    }
  }
}
