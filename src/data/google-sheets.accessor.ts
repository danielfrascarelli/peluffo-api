import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleAuth } from "google-auth-library";
import { EnvNames } from "@/common/config.options";

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

// Reads with the service account key at GOOGLE_APPLICATION_CREDENTIALS. It only sees sheets shared with it.
// ponytail: no circuit breaker; the only caller is the dependencies health check. Add opossum when a request path reads the sheet.
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
}
