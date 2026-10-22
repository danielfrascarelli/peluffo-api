export const SHEET_TITLE = "PELUFFO GIGUENS";
export const SHEET_RANGE = `'${SHEET_TITLE}'!A:S`;

export const COLUMNS = {
  submittedAt: { index: 0, header: "Marca temporal" },
  fullName: { index: 1, header: "Nombre y Apellido" },
  phone: { index: 2, header: "Teléfono" },
  age: { index: 3, header: "¿Cuántos años tenes?" },
  email: { index: 4, header: "Correo electrónico" },
  cedula: { index: 5, header: "Cédula de Identidad" },
  city: { index: 6, header: "¿En qué ciudad vivís?" },
  motive: { index: 7, header: "Contanos brevemente" },
  continueWithFee: { index: 8, header: "Luego de los 4 encuentros" },
  healthProvider: { index: 9, header: "¿Cuál es tu prestador de Salud?" },
  healthProviderName: { index: 10, header: "Nombre del Prestador de Salud" },
  howDidYouHear: { index: 11, header: "¿Cómo llegaste a conocer" },
  requestFor: { index: 12, header: "¿Quién solicita" },
  diagnosis: { index: 13, header: "¿Cuál es el diagnóstico de cáncer?" },
  diagnosisSince: { index: 14, header: "¿Hace cuánto tiempo" },
  firstDiagnosis: { index: 15, header: "¿Es el primer diagnóstico?" },
  assignedAt: { index: 16, header: "Columna 1" },
  psychologist: { index: 17, header: "Psicólogo Asignado" },
} as const;
