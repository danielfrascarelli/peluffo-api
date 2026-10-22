import type {
  Extraction,
  ExtractionIssue,
  ExtractionIssueCell,
  SheetCell,
  SheetCapture,
  SourceRow,
} from "@/data/extraction.types";
import {
  emptyResources,
  PATIENT_TEXT_FIELDS,
  type Patient,
  type Assignment,
  type Psychologist,
} from "@/data/resources.types";
import { COLUMNS, SHEET_TITLE } from "@/modules/data-extractions/sheet-columns";
import { normalizeName, resourceId } from "@/modules/data-extractions/resource-identity";
import { sheetDate, sheetTimestamp } from "@/modules/data-extractions/sheet-dates";

type Field = keyof typeof COLUMNS;

function cell(row: SourceRow, field: Field): SheetCell {
  return row.cells[COLUMNS[field].index] ?? {};
}

function text(row: SourceRow, field: Field): string {
  const entry = cell(row, field);
  if (entry.effectiveValue?.errorValue) return "";
  return (
    entry.effectiveValue?.stringValue ??
    entry.formattedValue ??
    String(entry.effectiveValue?.numberValue ?? "")
  ).trim();
}

function cedulaOf(row: SourceRow): string | undefined {
  const entry = cell(row, "cedula");
  const value =
    entry.effectiveValue?.numberValue !== undefined ? String(entry.effectiveValue.numberValue) : text(row, "cedula");
  if (!/^[\d.\s-]+$/.test(value)) return undefined;
  return value.replace(/\D/g, "") || undefined;
}

function displayValue(row: SourceRow, field: Field): string {
  const entry = cell(row, field);
  const value = entry.effectiveValue;
  return (
    entry.formattedValue ??
    value?.stringValue ??
    String(value?.numberValue ?? value?.boolValue ?? value?.errorValue?.type ?? "")
  );
}

function issueCell(row: SourceRow, field: Field): ExtractionIssueCell {
  return { column: String.fromCharCode(65 + COLUMNS[field].index), value: displayValue(row, field) };
}

function rowIssue(
  row: SourceRow,
  field: string,
  code: string,
  message: string,
  fields: Field[],
  relatedRows?: number[],
): ExtractionIssue {
  return {
    row: row.row,
    field,
    code,
    message,
    context: {
      patient: { fullName: displayValue(row, "fullName"), cedula: displayValue(row, "cedula") },
      cells: fields.map((field) => issueCell(row, field)),
      normalizedCedula: cedulaOf(row),
      relatedRows,
    },
  };
}

function normalizedHeader(value: string): string {
  return value
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headerIssue(source: SheetCapture): ExtractionIssue | undefined {
  const header = source.rows.find((row) => row.row === 1) ?? { row: 1, cells: [] };
  const mismatches = (Object.keys(COLUMNS) as Field[]).filter(
    (field) => !normalizedHeader(text(header, field)).startsWith(normalizedHeader(COLUMNS[field].header)),
  );
  if (source.sheetTitle === SHEET_TITLE && mismatches.length === 0) return undefined;
  return {
    row: 1,
    field: "headers",
    code: "INVALID_HEADERS",
    message: "Sheet title or form headers do not match",
    context: {
      cells: mismatches.map((field) => ({ ...issueCell(header, field), expected: COLUMNS[field].header })),
      expectedSheet: SHEET_TITLE,
      actualSheet: source.sheetTitle,
    },
  };
}

function patientOf(row: SourceRow, cedula: string, warnings: ExtractionIssue[]): Patient {
  const patient: Patient = { id: resourceId("p", cedula), cedula, assignmentStatus: "pending" };
  for (const field of PATIENT_TEXT_FIELDS) {
    const value = text(row, field);
    if (value) patient[field] = value;
  }
  const ageMatch = /^(\d+)(?:\s*años?)?$/iu.exec(text(row, "age"));
  const age = cell(row, "age").effectiveValue?.numberValue ?? (ageMatch ? Number(ageMatch[1]) : undefined);
  if (age !== undefined && Number.isSafeInteger(age) && age >= 0) patient.age = age;
  else warnings.push(rowIssue(row, "age", "INVALID_AGE", "Age is missing or is not a non-negative integer", ["age"]));
  const submittedAt = sheetTimestamp(cell(row, "submittedAt"));
  if (submittedAt) patient.submittedAt = submittedAt;
  else
    warnings.push(
      rowIssue(row, "submittedAt", "INVALID_DATE", "Submission date is missing or invalid", ["submittedAt"]),
    );
  if (patient.age !== undefined && submittedAt) patient.ageRecordedAt = submittedAt;
  return patient;
}

function psychologistOf(row: SourceRow): Psychologist | undefined {
  const name = normalizeName(text(row, "psychologist"));
  return name ? { id: resourceId("ps", name.toLocaleLowerCase("es-UY")), fullName: name } : undefined;
}

function assignmentOf(
  row: SourceRow,
  patient: Patient,
  psychologist: Psychologist | undefined,
  warnings: ExtractionIssue[],
): Assignment | undefined {
  const dateCell = cell(row, "assignedAt");
  const startDate = sheetDate(dateCell);
  const hasDate = dateCell.effectiveValue?.numberValue !== undefined || !!displayValue(row, "assignedAt").trim();
  const hasPsychologist = !!displayValue(row, "psychologist").trim();
  if (!hasPsychologist && !hasDate) return undefined;
  if (!psychologist || !startDate) {
    const problems: string[] = [];
    if (!hasDate) problems.push("Assignment date is missing (column Q)");
    else if (!startDate) problems.push("Assignment date is invalid (column Q)");
    if (!psychologist)
      problems.push(hasPsychologist ? "Psychologist is invalid (column R)" : "Psychologist is missing (column R)");
    warnings.push(
      rowIssue(row, "assignment", "INVALID_ASSIGNMENT", problems.join("; "), ["assignedAt", "psychologist"]),
    );
    return undefined;
  }
  return {
    id: resourceId("a", `${patient.id}:${psychologist.id}:${startDate}`),
    patientId: patient.id,
    psychologistId: psychologist.id,
    startDate,
  };
}

function patientRows(source: SheetCapture, errors: ExtractionIssue[]): { row: SourceRow; cedula: string }[] {
  const rows = source.rows.filter(
    (row) =>
      row.row > 1 &&
      row.cells.some(
        (entry) =>
          entry.effectiveValue !== undefined || !!entry.formattedValue?.trim() || entry.userEnteredValue !== undefined,
      ),
  );
  const cedulaRows = new Map<string, number[]>();
  for (const row of rows) {
    const cedula = cedulaOf(row);
    if (cedula) {
      const related = cedulaRows.get(cedula) ?? [];
      related.push(row.row);
      cedulaRows.set(cedula, related);
    }
  }
  const validRows: { row: SourceRow; cedula: string }[] = [];
  for (const row of rows) {
    const cedula = cedulaOf(row);
    const relatedRows = cedula ? cedulaRows.get(cedula) : undefined;
    if (!cedula || (relatedRows?.length ?? 0) > 1) {
      errors.push(
        rowIssue(
          row,
          "cedula",
          cedula ? "DUPLICATE_CEDULA" : "INVALID_CEDULA",
          cedula ? "All rows sharing this cedula are excluded" : "Cedula is missing or invalid",
          ["cedula"],
          relatedRows,
        ),
      );
      continue;
    }
    validRows.push({ row, cedula });
  }
  return validRows;
}

export function mapSheet(source: SheetCapture): Extraction {
  const resources = emptyResources();
  const report = { warnings: [] as ExtractionIssue[], errors: [] as ExtractionIssue[] };
  const invalidHeader = headerIssue(source);
  if (invalidHeader) {
    report.errors.push(invalidHeader);
    return { resources, report };
  }
  const psychologists = new Map<string, Psychologist>();
  for (const { row, cedula } of patientRows(source, report.errors)) {
    const patient = patientOf(row, cedula, report.warnings);
    const psychologist = psychologistOf(row);
    if (psychologist) psychologists.set(psychologist.id, psychologist);
    const assigned = assignmentOf(row, patient, psychologist, report.warnings);
    if (assigned) {
      patient.assignmentStatus = "assigned";
      resources.assignments.push(assigned);
    }
    resources.patients.push(patient);
  }
  resources.psychologists = [...psychologists.values()];
  return { resources, report };
}
