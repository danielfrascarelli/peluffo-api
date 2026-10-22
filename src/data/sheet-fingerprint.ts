import { createHash } from "node:crypto";
import type { CellValue, SheetCapture, SheetCell } from "@/data/extraction.types";

function canonicalValue(value?: CellValue): unknown[] | null {
  const fields = [
    value?.numberValue ?? null,
    value?.stringValue || null,
    value?.boolValue ?? null,
    value?.formulaValue || null,
    value?.errorValue?.type || null,
    value?.errorValue?.message || null,
  ];
  return fields.some((field) => field !== null) ? fields : null;
}

function canonicalCell(cell: SheetCell): unknown[] | null {
  const display = cell.formattedValue ?? "";
  const effective = canonicalValue(cell.effectiveValue);
  const original = canonicalValue(cell.userEnteredValue);
  return display || effective || original ? [display, effective, original] : null;
}

export function sheetFingerprint(source: SheetCapture): string {
  const rows = source.rows
    .map(({ row, cells }) => {
      const values = cells.slice(0, 19).map(canonicalCell);
      while (values.length && values.at(-1) === null) values.pop();
      return { row, values };
    })
    .filter(({ values }) => values.length > 0);
  const content = [source.spreadsheetId, source.sheetTitle, rows];
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}
