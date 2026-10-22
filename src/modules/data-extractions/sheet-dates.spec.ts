import { sheetDate, sheetTimestamp } from "@/modules/data-extractions/sheet-dates";

describe("Sheet dates in America/Montevideo", () => {
  it("converts timestamps without shifting assignment calendar dates", () => {
    const cell = { formattedValue: "21/10/2026 23:30:00" };
    expect(sheetTimestamp(cell)).toBe("2026-10-22T02:30:00.000Z");
    expect(sheetDate(cell)).toBe("2026-10-21");
  });
  it("interprets serial values independently of cell display formatting", () => {
    const serial = (Date.UTC(2026, 9, 21, 14, 30) - Date.UTC(1899, 11, 30)) / 86_400_000;
    expect(sheetTimestamp({ formattedValue: "Oct 21", effectiveValue: { numberValue: serial } })).toBe(
      "2026-10-21T17:30:00.000Z",
    );
  });
  it.each(["31/02/2026", "31/04/2026", "29/02/2025", "01/13/2026", "21/10/2026 25:00:00", "", "invalid"])(
    "rejects invalid date %s",
    (value) => {
      expect(sheetTimestamp({ formattedValue: value })).toBeUndefined();
      expect(sheetDate({ formattedValue: value })).toBeUndefined();
    },
  );
  it("accepts leap years", () => {
    expect(sheetDate({ formattedValue: "29/02/2024" })).toBe("2024-02-29");
  });
});
