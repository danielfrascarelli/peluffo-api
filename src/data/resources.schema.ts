import Joi from "joi";
import { PATIENT_TEXT_FIELDS, type Resources } from "@/data/resources.types";

const resourcesSchema = Joi.object({
  patients: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        cedula: Joi.string().pattern(/^\d+$/).required(),
        assignmentStatus: Joi.string().valid("pending", "assigned").required(),
        age: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER),
        submittedAt: Joi.string().isoDate(),
        ageRecordedAt: Joi.string().isoDate(),
        ...Object.fromEntries(PATIENT_TEXT_FIELDS.map((field) => [field, Joi.string()])),
      }),
    )
    .unique("id")
    .unique("cedula")
    .required(),
  psychologists: Joi.array()
    .items(Joi.object({ id: Joi.string().required(), fullName: Joi.string().required() }))
    .unique("id")
    .required(),
  assignments: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        patientId: Joi.string().required(),
        psychologistId: Joi.string().required(),
        startDate: Joi.string().isoDate().required(),
        closedObservedAt: Joi.string().isoDate(),
      }),
    )
    .unique("id")
    .required(),
});

export function validateResources(value: unknown): Resources {
  const result = resourcesSchema.validate(value, { convert: false });
  if (result.error) throw new Error("Invalid stored resource schema");
  const resources = result.value as Resources;
  const patientIds = new Set(resources.patients.map((patient) => patient.id));
  const psychologistIds = new Set(resources.psychologists.map((psychologist) => psychologist.id));
  const activePatients = new Set<string>();
  for (const assignment of resources.assignments) {
    if (!patientIds.has(assignment.patientId) || !psychologistIds.has(assignment.psychologistId)) {
      throw new Error("Stored assignment references a missing resource");
    }
    if (!assignment.closedObservedAt) {
      if (activePatients.has(assignment.patientId)) throw new Error("Multiple active assignments for one patient");
      activePatients.add(assignment.patientId);
    }
  }
  if (
    resources.patients.some((patient) => (patient.assignmentStatus === "assigned") !== activePatients.has(patient.id))
  ) {
    throw new Error("Stored patient status does not match active assignments");
  }
  return resources;
}
