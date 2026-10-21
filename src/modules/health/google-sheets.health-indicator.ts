import { Injectable, Logger } from "@nestjs/common";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";
import { GoogleSheetsAccessor, type SpreadsheetMetadata } from "@/data/google-sheets.accessor";

export type GoogleSheetsHealth =
  | HealthIndicatorResult<"googleSheets", "up", SpreadsheetMetadata>
  | HealthIndicatorResult<"googleSheets", "down", { reason: string }>;

const reasonByStatus: Partial<Record<number, string>> = {
  403: "permission denied: share the sheet with the service account and enable the Sheets API",
  404: "spreadsheet not found: check GOOGLE_SHEET_ID",
};

// Gaxios errors carry the request config, Authorization header included, so only status and message are logged.
function describe(error: unknown): { status?: number; message: string } {
  const status =
    typeof error === "object" && error !== null && "response" in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;
  return { status, message: error instanceof Error ? error.message : String(error) };
}

@Injectable()
export class GoogleSheetsHealthIndicator {
  private readonly logger = new Logger(GoogleSheetsHealthIndicator.name);

  constructor(
    private readonly indicators: HealthIndicatorService,
    private readonly sheets: GoogleSheetsAccessor,
  ) {}

  async check(): Promise<GoogleSheetsHealth> {
    const indicator = this.indicators.check("googleSheets");
    if (!this.sheets.configured) return indicator.down({ reason: "not configured" });
    try {
      return indicator.up({ ...(await this.sheets.metadata()) });
    } catch (error) {
      const { status, message } = describe(error);
      this.logger.warn({ status, message }, "Google Sheets check failed");
      return indicator.down({ reason: reasonByStatus[status ?? 0] ?? "unreachable" });
    }
  }
}
