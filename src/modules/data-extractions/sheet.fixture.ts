import type { SheetCapture, SheetCell } from "@/data/extraction.types";
import { COLUMNS } from "@/modules/data-extractions/sheet-columns";

const headers = [
  "Marca temporal",
  "Nombre y Apellido\n(Ej: María García)",
  "Teléfono\n(Ej: 099 123 545)",
  "¿Cuántos años tenes?\n(Ej: 34)",
  "Correo electrónico",
  "Cédula de Identidad",
  "¿En qué ciudad vivís?",
  "Contanos brevemente en qué te podemos ayudar.",
  "Luego de los 4 encuentros gratuitos, ¿te gustaría continuar?",
  "¿Cuál es tu prestador de Salud?",
  "Nombre del Prestador de Salud",
  "¿Cómo llegaste a conocer el servicio?",
  "¿Quién solicita el acompañamiento psicológico?",
  "¿Cuál es el diagnóstico de cáncer?",
  "¿Hace cuánto tiempo fue el diagnóstico?",
  "⁠¿Es el primer diagnóstico?",
  "Columna 1",
  "Psicólogo Asignado",
  "Datos Para el Psicólogo",
];

type RowValues = Partial<Record<keyof typeof COLUMNS, string | number>>;

function toCell(value: string | number): SheetCell {
  return {
    formattedValue: String(value),
    effectiveValue: typeof value === "number" ? { numberValue: value } : { stringValue: value },
  };
}

export function sheetFixture(rows: RowValues[] = [{}], capturedAt = "2026-10-21T17:38:00.123Z"): SheetCapture {
  return {
    capturedAt,
    spreadsheetId: "testing-sheet",
    sheetTitle: "PELUFFO GIGUENS",
    rows: [
      { row: 1, cells: headers.map(toCell) },
      ...rows.map((overrides, index) => {
        const values: RowValues = {
          submittedAt: "21/10/2026 14:30:00",
          fullName: "Ana Pérez",
          phone: "099 123 456",
          age: "34",
          email: "ana@example.com",
          cedula: "4.567.890-1",
          city: "Montevideo",
          motive: "Support",
          continueWithFee: "Sí",
          healthProvider: "FONASA",
          healthProviderName: "ASSE",
          howDidYouHear: "Google",
          requestFor: "Para mí",
          diagnosis: "Testing diagnosis",
          diagnosisSince: "2025",
          firstDiagnosis: "Sí",
          assignedAt: "22/10/2026",
          psychologist: "Dra. López",
          ...overrides,
        };
        const cells: SheetCell[] = Array.from({ length: 19 }, () => ({}));
        for (const [field, value] of Object.entries(values))
          cells[COLUMNS[field as keyof typeof COLUMNS].index] = toCell(value);
        return { row: index + 2, cells };
      }),
    ],
  };
}
