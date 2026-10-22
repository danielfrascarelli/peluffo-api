export interface Patient {
  id: string;
  cedula: string;
  fullName?: string;
  phone?: string;
  age?: number;
  ageRecordedAt?: string;
  email?: string;
  city?: string;
  motive?: string;
  continueWithFee?: string;
  healthProvider?: string;
  healthProviderName?: string;
  howDidYouHear?: string;
  requestFor?: string;
  diagnosis?: string;
  diagnosisSince?: string;
  firstDiagnosis?: string;
  submittedAt?: string;
  assignmentStatus: "assigned" | "pending";
}

export interface Psychologist {
  id: string;
  fullName: string;
}

export interface Assignment {
  id: string;
  patientId: string;
  psychologistId: string;
  startDate: string;
  closedObservedAt?: string;
}

export interface Resources {
  patients: Patient[];
  psychologists: Psychologist[];
  assignments: Assignment[];
}

export const RESOURCE_NAMES = ["patients", "psychologists", "assignments"] as const;

export const PATIENT_TEXT_FIELDS = [
  "fullName",
  "phone",
  "email",
  "city",
  "motive",
  "continueWithFee",
  "healthProvider",
  "healthProviderName",
  "howDidYouHear",
  "requestFor",
  "diagnosis",
  "diagnosisSince",
  "firstDiagnosis",
] as const satisfies readonly (keyof Patient)[];

export function emptyResources(): Resources {
  return { patients: [], psychologists: [], assignments: [] };
}
