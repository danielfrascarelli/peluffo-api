import { restoreAgeReferences } from "@/data/patient-age";
import type { Patient } from "@/data/resources.types";

const patient: Patient = {
  id: "p1",
  cedula: "12345678",
  assignmentStatus: "pending",
  age: 40,
  submittedAt: "2024-01-10T03:00:00Z",
};

describe("legacy age references", () => {
  it("anchors only the age/date pair confirmed by the active extracted patient, without mutating it", () => {
    expect(restoreAgeReferences([patient], [{ ...patient }])).toEqual([
      { ...patient, ageRecordedAt: patient.submittedAt },
    ]);
    expect(patient).not.toHaveProperty("ageRecordedAt");
  });

  it.each([
    { extracted: [] },
    { extracted: [{ ...patient, age: 41 }] },
    { extracted: [{ ...patient, submittedAt: "2025-01-10T03:00:00Z" }] },
    { extracted: [{ ...patient, id: "different" }] },
  ])("leaves an unconfirmed legacy age unanchored", ({ extracted }) => {
    expect(restoreAgeReferences([patient], extracted)).toEqual([patient]);
  });

  it("preserves an explicit reference despite a newer independently corrected submission date", () => {
    const explicit = { ...patient, ageRecordedAt: "2023-01-10T03:00:00Z" };
    expect(restoreAgeReferences([explicit], [patient])).toEqual([explicit]);
  });
});
