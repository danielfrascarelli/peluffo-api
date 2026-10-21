import { HealthIndicatorService } from "@nestjs/terminus";
import type { GoogleSheetsAccessor } from "@/data/google-sheets.accessor";
import { GoogleSheetsHealthIndicator } from "@/modules/health/google-sheets.health-indicator";

const indicatorFor = (sheets: Partial<GoogleSheetsAccessor>): GoogleSheetsHealthIndicator =>
  new GoogleSheetsHealthIndicator(new HealthIndicatorService(), sheets as GoogleSheetsAccessor);

const httpError = (status: number): Error =>
  Object.assign(new Error(`Request failed with ${status}`), { response: { status } });

describe("GoogleSheetsHealthIndicator", () => {
  it("is down without calling Google when not configured", async () => {
    const metadata = jest.fn();
    await expect(indicatorFor({ configured: false, metadata }).check()).resolves.toEqual({
      googleSheets: { status: "down", reason: "not configured" },
    });
    expect(metadata).not.toHaveBeenCalled();
  });

  it("is up with the spreadsheet title and tabs when access works", async () => {
    const metadata = jest.fn().mockResolvedValue({ title: "Pacientes", tabs: ["Hoja 1"] });
    await expect(indicatorFor({ configured: true, metadata }).check()).resolves.toEqual({
      googleSheets: { status: "up", title: "Pacientes", tabs: ["Hoja 1"] },
    });
  });

  it.each([
    [403, /share the sheet with the service account/],
    [404, /check GOOGLE_SHEET_ID/],
    [500, /unreachable/],
  ])("explains a %i from Google", async (status, reason) => {
    const metadata = jest.fn().mockRejectedValue(httpError(status));
    const result = await indicatorFor({ configured: true, metadata }).check();
    expect(result.googleSheets).toEqual({ status: "down", reason: expect.stringMatching(reason) as unknown });
  });
});
