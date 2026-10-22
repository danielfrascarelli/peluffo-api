import type { Resources } from "@/data/resources.types";

export interface CellValue {
  stringValue?: string;
  numberValue?: number;
  boolValue?: boolean;
  formulaValue?: string;
  errorValue?: { type: string; message?: string };
}

export interface SheetCell {
  formattedValue?: string;
  effectiveValue?: CellValue;
  userEnteredValue?: CellValue;
}

export interface SourceRow {
  row: number;
  cells: SheetCell[];
}

export interface SheetCapture {
  capturedAt: string;
  spreadsheetId: string;
  sheetTitle: string;
  rows: SourceRow[];
}

export interface ExtractionIssue {
  row: number;
  field: string;
  code: string;
  message: string;
  context: ExtractionIssueContext;
}

export interface ExtractionIssueCell {
  column: string;
  value: string;
  expected?: string;
}

export interface ExtractionIssueContext {
  patient?: { fullName: string; cedula: string };
  cells: ExtractionIssueCell[];
  normalizedCedula?: string;
  relatedRows?: number[];
  expectedSheet?: string;
  actualSheet?: string;
}

export interface ExtractionReport {
  warnings: ExtractionIssue[];
  errors: ExtractionIssue[];
}

export interface Extraction {
  resources: Resources;
  report: ExtractionReport;
}

export interface ExtractionState {
  extractionId?: string;
  lastExtractionId: string;
  sourceHash: string;
}

export interface DataExtractionResult {
  extractionId: string;
  path: string;
  reportPath: string;
  checkedAt: string;
  changed: boolean;
  applied: boolean;
  counts: { extracted: ResourceCounts; processed: ResourceCounts };
  warnings: number;
  errors: number;
  report: ExtractionReport;
}

type ResourceCounts = Record<keyof Resources, number>;

export function resourceCounts(resources: Resources): ResourceCounts {
  return {
    patients: resources.patients.length,
    psychologists: resources.psychologists.length,
    assignments: resources.assignments.length,
  };
}
