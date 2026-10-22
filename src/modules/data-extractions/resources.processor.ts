import type { Assignment, Patient, Resources } from "@/data/resources.types";

function mergePatient(previous: Patient | undefined, current: Patient): Patient {
  const merged = { ...previous, ...current };
  // An age without its date must not borrow the previous observation's reference.
  if (previous && (current.age === undefined || !current.ageRecordedAt)) {
    merged.age = previous.age;
    merged.ageRecordedAt = previous.ageRecordedAt;
  }
  return merged;
}

function mergeAssignments(
  previous: Assignment[],
  current: Assignment[],
  presentPatients: Set<string>,
  observedAt: string,
): Assignment[] {
  const activeIds = new Set(current.map((assignment) => assignment.id));
  const assignments = new Map(previous.map((assignment) => [assignment.id, assignment]));
  for (const assignment of previous) {
    if (!assignment.closedObservedAt && presentPatients.has(assignment.patientId) && !activeIds.has(assignment.id)) {
      assignments.set(assignment.id, { ...assignment, closedObservedAt: observedAt });
    }
  }
  for (const assignment of current) assignments.set(assignment.id, assignment);
  return [...assignments.values()];
}

export function processResources(previous: Resources, extracted: Resources, observedAt: string): Resources {
  const patients = new Map(previous.patients.map((patient) => [patient.cedula, patient]));
  for (const patient of extracted.patients) {
    patients.set(patient.cedula, mergePatient(patients.get(patient.cedula), patient));
  }
  const psychologists = new Map(previous.psychologists.map((psychologist) => [psychologist.id, psychologist]));
  for (const psychologist of extracted.psychologists) psychologists.set(psychologist.id, psychologist);
  return {
    patients: [...patients.values()],
    psychologists: [...psychologists.values()],
    assignments: mergeAssignments(
      previous.assignments,
      extracted.assignments,
      new Set(extracted.patients.map((patient) => patient.id)),
      observedAt,
    ),
  };
}
