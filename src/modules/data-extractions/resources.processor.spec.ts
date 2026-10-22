import { emptyResources } from "@/data/resources.types";
import { mapSheet } from "@/modules/data-extractions/sheet.mapper";
import { sheetFixture } from "@/modules/data-extractions/sheet.fixture";
import { processResources } from "@/modules/data-extractions/resources.processor";

const observedAt = "2026-10-22T16:00:00.000Z";

describe("accumulated resources", () => {
  it("updates age and reference together, preserving the pair when either new value is invalid", () => {
    const previous = mapSheet(sheetFixture()).resources;
    const invalidAge = mapSheet(sheetFixture([{ age: "invalid", submittedAt: "01/01/2024" }])).resources;
    const result = processResources(previous, invalidAge, observedAt).patients[0]!;
    expect(result).toMatchObject({ age: 34, ageRecordedAt: previous.patients[0]!.submittedAt });
    expect(result.submittedAt).not.toBe(result.ageRecordedAt);
    const invalidDate = mapSheet(sheetFixture([{ age: "41", submittedAt: "invalid" }])).resources;
    expect(invalidDate.patients[0]).not.toHaveProperty("ageRecordedAt");
    expect(processResources(previous, invalidDate, observedAt).patients[0]).toMatchObject({
      age: 34,
      ageRecordedAt: previous.patients[0]!.submittedAt,
    });
    const valid = mapSheet(sheetFixture([{ age: "41", submittedAt: "01/01/2024" }])).resources;
    expect(processResources(previous, valid, observedAt).patients[0]).toMatchObject({
      age: 41,
      ageRecordedAt: "2024-01-01T03:00:00.000Z",
    });
  });

  it("retains absent patients and relationships, updating only present valid fields", () => {
    const previous = mapSheet(sheetFixture([{}, { cedula: "12345678", fullName: "Retained" }])).resources;
    const extracted = mapSheet(sheetFixture([{ age: "invalid", email: "", city: "Salto" }])).resources;
    const processed = processResources(previous, extracted, observedAt);
    expect(processed.patients).toHaveLength(2);
    expect(processed.patients[0]).toMatchObject({ age: 34, email: "ana@example.com", city: "Salto" });
    expect(processed.patients[1]).toEqual(previous.patients[1]);
    expect(processed.assignments).toEqual(previous.assignments);
    expect(extracted.patients).toHaveLength(1);
    expect(extracted.patients[0]).not.toHaveProperty("age");
  });

  it("keeps the last valid patient and relationships when current rows are duplicated", () => {
    const previous = mapSheet(sheetFixture()).resources;
    const extracted = mapSheet(sheetFixture([{}, {}])).resources;
    expect(processResources(previous, extracted, observedAt)).toEqual(previous);
  });

  it("closes observed assignments when a present patient becomes pending", () => {
    const previous = mapSheet(sheetFixture()).resources;
    const extracted = mapSheet(sheetFixture([{ assignedAt: "", psychologist: "" }])).resources;
    const processed = processResources(previous, extracted, observedAt);
    expect(processed.patients[0]?.assignmentStatus).toBe("pending");
    expect(processed.assignments[0]).toMatchObject({ closedObservedAt: observedAt });
    expect(processed.assignments[0]).not.toHaveProperty("endDate");
    expect(previous.assignments[0]).not.toHaveProperty("closedObservedAt");
  });

  it("keeps history when the psychologist changes and is idempotent for repeated input", () => {
    const previous = mapSheet(sheetFixture()).resources;
    const extracted = mapSheet(sheetFixture([{ psychologist: "Other Name" }])).resources;
    const processed = processResources(previous, extracted, observedAt);
    expect(processed.assignments).toHaveLength(2);
    expect(processed.assignments.filter((assignment) => !assignment.closedObservedAt)).toHaveLength(1);
    expect(processResources(processed, extracted, observedAt)).toEqual(processed);
    expect(processResources(emptyResources(), extracted, observedAt)).toEqual(extracted);
  });
});
