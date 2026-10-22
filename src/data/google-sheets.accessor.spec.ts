import { ConfigService } from "@nestjs/config";
import { GoogleSheetsAccessor } from "@/data/google-sheets.accessor";

const mockRequest = jest.fn<Promise<{ data: unknown }>, [unknown]>();
jest.mock("google-auth-library", () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({ request: mockRequest })),
}));

describe("Google Sheets capture boundary", () => {
  const accessor = (): GoogleSheetsAccessor =>
    new GoogleSheetsAccessor(
      new ConfigService({
        GOOGLE_APPLICATION_CREDENTIALS: "secrets/test-only.json",
        GOOGLE_SHEET_ID: "test-sheet",
      }),
    );
  beforeEach(() => mockRequest.mockReset());

  it("captures original and calculated values with stable row positions in one bounded read", async () => {
    const cell = {
      formattedValue: "21/10/2026",
      effectiveValue: { numberValue: 46316 },
      userEnteredValue: { formulaValue: "=TODAY()" },
    };
    mockRequest.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: { title: "PELUFFO GIGUENS" },
            data: [{ startRow: 0, rowData: [{ values: [cell] }, {}, { values: [{ formattedValue: "" }] }] }],
          },
        ],
      },
    });
    const result = await accessor().capture("'PELUFFO GIGUENS'!A:S");
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ timeout: 5000, retry: false }));
    expect(result.spreadsheetId).toBe("test-sheet");
    expect(result.rows).toEqual([
      { row: 1, cells: [cell] },
      { row: 2, cells: [] },
      { row: 3, cells: [{ formattedValue: "" }] },
    ]);
  });

  it("rejects malformed response types without exposing cell contents", async () => {
    mockRequest.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: { title: "PELUFFO GIGUENS" },
            data: [{ rowData: [{ values: [{ effectiveValue: { numberValue: "sensitive invalid value" } }] }] }],
          },
        ],
      },
    });
    await expect(accessor().capture("range")).rejects.toThrow("Invalid Google Sheets grid response");
  });

  it("represents an empty grid without inventing rows", async () => {
    mockRequest.mockResolvedValue({ data: { sheets: [{ properties: { title: "PELUFFO GIGUENS" } }] } });
    expect((await accessor().capture("range")).rows).toEqual([]);
  });
});
