import { sheetFingerprint } from "@/data/sheet-fingerprint";
import { sheetFixture } from "@/modules/data-extractions/sheet.fixture";

describe("Sheet content fingerprint", () => {
  it("ignores capture time, object key order and empty padding", () => {
    const original = sheetFixture();
    const equivalent = structuredClone(original);
    equivalent.capturedAt = "2026-10-22T17:38:00.123Z";
    equivalent.rows[1]!.cells[1] = { effectiveValue: { stringValue: "Ana Pérez" }, formattedValue: "Ana Pérez" };
    equivalent.rows[0]!.cells.push({}, { formattedValue: "" });
    equivalent.rows[1]!.cells[18] = { formattedValue: "", effectiveValue: { stringValue: "" }, userEnteredValue: {} };
    equivalent.rows.push({ row: 3, cells: [] }, { row: 4, cells: [{ formattedValue: "" }] });
    expect(sheetFingerprint(equivalent)).toBe(sheetFingerprint(original));
  });

  it.each([
    "header",
    "invalid row",
    "formula",
    "calculated value",
    "display",
    "column S",
    "row position",
    "spreadsheet",
    "title",
  ])("detects changes in %s", (change) => {
    const original = sheetFixture([{ age: "invalid" }]);
    const changed = structuredClone(original);
    switch (change) {
      case "header":
        changed.rows[0]!.cells[0]!.formattedValue = "Different header";
        break;
      case "invalid row":
        changed.rows[1]!.cells[3]!.effectiveValue = { stringValue: "still invalid" };
        break;
      case "formula":
        changed.rows[1]!.cells[3]!.userEnteredValue = { formulaValue: "=34" };
        break;
      case "calculated value":
        changed.rows[1]!.cells[3]!.effectiveValue = { numberValue: 34 };
        break;
      case "display":
        changed.rows[1]!.cells[3]!.formattedValue = "34,0";
        break;
      case "column S":
        changed.rows[1]!.cells[18] = { formattedValue: "Original summary changed" };
        break;
      case "row position":
        changed.rows[1]!.row = 3;
        break;
      case "spreadsheet":
        changed.spreadsheetId = "another-sheet";
        break;
      case "title":
        changed.sheetTitle = "another-tab";
        break;
    }
    expect(sheetFingerprint(changed)).not.toBe(sheetFingerprint(original));
  });

  it("distinguishes zero, false and whitespace from an empty cell", () => {
    const original = sheetFixture();
    for (const cell of [
      { effectiveValue: { numberValue: 0 } },
      { effectiveValue: { boolValue: false } },
      { formattedValue: " " },
    ]) {
      const changed = structuredClone(original);
      changed.rows[1]!.cells[18] = cell;
      expect(sheetFingerprint(changed)).not.toBe(sheetFingerprint(original));
    }
  });

  it("preserves interior gaps and record order", () => {
    const original = sheetFixture([{}, { cedula: "12345678" }]);
    const swapped = structuredClone(original);
    [swapped.rows[1]!.cells, swapped.rows[2]!.cells] = [swapped.rows[2]!.cells, swapped.rows[1]!.cells];
    expect(sheetFingerprint(swapped)).not.toBe(sheetFingerprint(original));
  });
});
