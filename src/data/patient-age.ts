import type { Patient } from "@/data/resources.types";

export function restoreAgeReferences(processed: Patient[], extracted: Patient[]): Patient[] {
  const observations = new Map(extracted.map((patient) => [patient.id, patient]));
  return processed.map((patient) => {
    if (patient.ageRecordedAt || patient.age === undefined) return patient;
    const observation = observations.get(patient.id);
    if (
      observation?.age === patient.age &&
      observation.submittedAt &&
      observation.submittedAt === patient.submittedAt
    ) {
      return { ...patient, ageRecordedAt: observation.submittedAt };
    }
    return patient;
  });
}
