import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleAuth } from "google-auth-library";
import Joi from "joi";
import { EnvNames } from "@/common/config.options";
import type { SheetCapture, SheetCell } from "@/data/extraction.types";
import { sheetCellSchema } from "@/data/sheet-capture.schema";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const TIMEOUT_MS = 5_000;

export interface SpreadsheetMetadata {
  title: string;
  tabs: string[];
}

interface SpreadsheetResponse {
  properties: { title: string };
  sheets: { properties: { title: string } }[];
}

interface GridResponse {
  sheets: { properties: { title: string }; data?: { startRow?: number; rowData?: { values?: SheetCell[] }[] }[] }[];
}

const gridSchema = Joi.object({
  sheets: Joi.array()
    .length(1)
    .items(
      Joi.object({
        properties: Joi.object({ title: Joi.string().required() }).required(),
        data: Joi.array().items(
          Joi.object({
            startRow: Joi.number().integer().min(0),
            rowData: Joi.array().items(
              Joi.object({
                values: Joi.array().items(sheetCellSchema),
              }),
            ),
          }),
        ),
      }),
    )
    .required(),
});

// Reads with the service account key at GOOGLE_APPLICATION_CREDENTIALS. It only sees sheets shared with it.
// shortcut: bounded admin-triggered reads use a timeout; add a breaker if automated callers are introduced.
@Injectable()
export class GoogleSheetsAccessor {
  private readonly auth?: GoogleAuth;
  private readonly sheetId?: string;

  constructor(config: ConfigService) {
    const keyFile = config.get<string>(EnvNames.GoogleCredentials);
    const sheetId = config.get<string>(EnvNames.GoogleSheetId);
    if (keyFile && sheetId) {
      this.auth = new GoogleAuth({ keyFile, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
      this.sheetId = sheetId;
    }
  }

  get configured(): boolean {
    return this.auth !== undefined;
  }

  // Metadata only: proves access without reading any cell.
  async metadata(): Promise<SpreadsheetMetadata> {
    if (!this.auth || !this.sheetId) throw new Error("Google Sheets is not configured");
    const { data } = await this.auth.request<SpreadsheetResponse>({
      url: `${SHEETS_API}/${encodeURIComponent(this.sheetId)}`,
      params: { fields: "properties.title,sheets.properties.title" },
      timeout: TIMEOUT_MS,
    });
    return { title: data.properties.title, tabs: data.sheets.map((s) => s.properties.title) };
  }

  async capture(range: string): Promise<SheetCapture> {
    if (!this.auth || !this.sheetId) throw new Error("Google Sheets is not configured");
    const { data } = await this.auth.request<unknown>({
      url: `${SHEETS_API}/${encodeURIComponent(this.sheetId)}`,
      params: {
        ranges: range,
        fields:
          "sheets(properties(title),data(startRow,rowData(values(formattedValue,effectiveValue,userEnteredValue))))",
      },
      timeout: TIMEOUT_MS,
      retry: false,
    });
    const validated = gridSchema.validate(data, { convert: false });
    if (validated.error) throw new Error("Invalid Google Sheets grid response");
    const sheet = (validated.value as GridResponse).sheets[0]!;
    return {
      capturedAt: new Date().toISOString(),
      spreadsheetId: this.sheetId,
      sheetTitle: sheet.properties.title,
      rows: (sheet.data ?? []).flatMap((grid) =>
        (grid.rowData ?? []).map((row, index) => ({
          row: (grid.startRow ?? 0) + index + 1,
          cells: row.values ?? [],
        })),
      ),
    };
  }
}
