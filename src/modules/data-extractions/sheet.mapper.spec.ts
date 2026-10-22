import { mapSheet } from "@/modules/data-extractions/sheet.mapper";
import { sheetFixture } from "@/modules/data-extractions/sheet.fixture";
import { COLUMNS } from "@/modules/data-extractions/sheet-columns";

describe("sheet mapping", () => {
  it("maps each form field, keeps J/K separate, and leaves the original capture unchanged", () => {
    const source = sheetFixture();
    const original = structuredClone(source);
    const { resources, report } = mapSheet(source);
    expect(resources.patients[0]).toEqual({
      id: expect.any(String) as unknown,
      cedula: "45678901",
      fullName: "Ana Pérez",
      phone: "099 123 456",
      age: 34,
      email: "ana@example.com",
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
      submittedAt: "2026-10-21T17:30:00.000Z",
      ageRecordedAt: "2026-10-21T17:30:00.000Z",
      assignmentStatus: "assigned",
    });
    expect(resources.psychologists[0]?.fullName).toBe("Dra. López");
    expect(resources.assignments[0]?.startDate).toBe("2026-10-22");
    expect(report).toEqual({ warnings: [], errors: [] });
    expect(source).toEqual(original);
  });

  it.each(["34", " 34 año ", "34 años", "34 AÑOS"])("accepts age %s", (age) => {
    expect(mapSheet(sheetFixture([{ age }])).resources.patients[0]?.age).toBe(34);
  });

  it("uses numeric ages independently of localized display formatting", () => {
    const source = sheetFixture([{ age: 34 }]);
    source.rows[1]!.cells[COLUMNS.age.index]!.formattedValue = "34,0";
    expect(mapSheet(source).resources.patients[0]?.age).toBe(34);
  });

  it("keeps a named psychologist even when the assignment date is missing", () => {
    const result = mapSheet(sheetFixture([{ assignedAt: "" }]));
    expect(result.resources.psychologists).toHaveLength(1);
    expect(result.resources.assignments).toEqual([]);
    expect(result.resources.patients[0]?.assignmentStatus).toBe("pending");
  });

  it.each(["", "treinta", "34 aprox", "-1", "3.5", "9007199254740992"])(
    "omits invalid age %s without dropping the patient",
    (age) => {
      const { resources, report } = mapSheet(sheetFixture([{ age }]));
      expect(resources.patients).toHaveLength(1);
      expect(resources.patients[0]).not.toHaveProperty("age");
      expect(report.warnings).toContainEqual(expect.objectContaining({ row: 2, field: "age", code: "INVALID_AGE" }));
    },
  );

  it("rejects all duplicate cedulas after normalization, not just the second row", () => {
    const result = mapSheet(sheetFixture([{}, { cedula: "45678901" }, { cedula: "12345678" }]));
    expect(result.resources.patients.map((patient) => patient.cedula)).toEqual(["12345678"]);
    expect(result.report.errors.map((error) => [error.row, error.code])).toEqual([
      [2, "DUPLICATE_CEDULA"],
      [3, "DUPLICATE_CEDULA"],
    ]);
    expect(result.report.errors.map((error) => error.context)).toEqual([
      {
        patient: { fullName: "Ana Pérez", cedula: "4.567.890-1" },
        cells: [{ column: "F", value: "4.567.890-1" }],
        normalizedCedula: "45678901",
        relatedRows: [2, 3],
      },
      {
        patient: { fullName: "Ana Pérez", cedula: "45678901" },
        cells: [{ column: "F", value: "45678901" }],
        normalizedCedula: "45678901",
        relatedRows: [2, 3],
      },
    ]);
  });

  it.each([{ assignedAt: "" }, { psychologist: "" }, { assignedAt: "31/02/2026" }])(
    "keeps patients pending for incomplete or invalid assignments: %j",
    (row) => {
      const result = mapSheet(sheetFixture([row]));
      expect(result.resources.patients[0]?.assignmentStatus).toBe("pending");
      expect(result.resources.assignments).toEqual([]);
      expect(result.report.warnings).toContainEqual(expect.objectContaining({ field: "assignment" }));
    },
  );

  it("deduplicates psychologist names by normalized whitespace, Unicode and case", () => {
    const result = mapSheet(sheetFixture([{}, { cedula: "12345678", psychologist: " dra.  lo\u0301pez " }]));
    expect(result.resources.psychologists).toHaveLength(1);
  });

  it.each([
    { assignedAt: "", psychologist: "Dra. López", message: "Assignment date is missing (column Q)" },
    { assignedAt: "22/10/2026", psychologist: "", message: "Psychologist is missing (column R)" },
    { assignedAt: "31/02/2026", psychologist: "Dra. López", message: "Assignment date is invalid (column Q)" },
    {
      assignedAt: "31/02/2026",
      psychologist: "",
      message: "Assignment date is invalid (column Q); Psychologist is missing (column R)",
    },
  ])("explains the assignment failure and identifies both cells: %j", ({ assignedAt, psychologist, message }) => {
    const result = mapSheet(sheetFixture([{ assignedAt, psychologist }]));
    expect(result.report.warnings).toContainEqual({
      row: 2,
      field: "assignment",
      code: "INVALID_ASSIGNMENT",
      message,
      context: {
        patient: { fullName: "Ana Pérez", cedula: "4.567.890-1" },
        normalizedCedula: "45678901",
        relatedRows: undefined,
        cells: [
          { column: "Q", value: assignedAt },
          { column: "R", value: psychologist },
        ],
      },
    });
  });

  it("reports original age and submission date values without including unrelated clinical fields", () => {
    const result = mapSheet(
      sheetFixture([{ age: "unknown", submittedAt: "31/02/2026", motive: "Private clinical text" }]),
    );
    expect(result.report.warnings.map((warning) => warning.context.cells)).toEqual([
      [{ column: "D", value: "unknown" }],
      [{ column: "A", value: "31/02/2026" }],
    ]);
    expect(result.report.warnings.every((warning) => warning.context.patient?.fullName === "Ana Pérez")).toBe(true);
    expect(JSON.stringify(result.report)).not.toContain("Private clinical text");
  });

  it("reports assignment cells containing spreadsheet errors even when no psychologist is present", () => {
    const source = sheetFixture([{ psychologist: "" }]);
    source.rows[1]!.cells[COLUMNS.assignedAt.index] = {
      formattedValue: "#VALUE!",
      effectiveValue: { errorValue: { type: "VALUE" } },
    };
    const warning = mapSheet(source).report.warnings[0];
    expect(warning?.context.cells).toEqual([
      { column: "Q", value: "#VALUE!" },
      { column: "R", value: "" },
    ]);
    expect(warning?.message).toBe("Assignment date is invalid (column Q); Psychologist is missing (column R)");
  });

  it("rejects missing cedulas and invalid headers without losing the source", () => {
    const source = sheetFixture([{ cedula: "letters123" }]);
    const cedulaError = mapSheet(source).report.errors[0];
    expect(cedulaError?.code).toBe("INVALID_CEDULA");
    expect(cedulaError?.context.patient).toEqual({ fullName: "Ana Pérez", cedula: "letters123" });
    expect(cedulaError?.context.cells).toEqual([{ column: "F", value: "letters123" }]);
    source.rows[0]!.cells[COLUMNS.age.index] = { formattedValue: "Unexpected" };
    const headerError = mapSheet(source).report.errors[0];
    expect(headerError?.code).toBe("INVALID_HEADERS");
    expect(headerError?.context.cells).toEqual([{ column: "D", value: "Unexpected", expected: COLUMNS.age.header }]);
    expect(headerError?.context.expectedSheet).toBe("PELUFFO GIGUENS");
    expect(headerError?.context.actualSheet).toBe("PELUFFO GIGUENS");
  });

  it("accepts empty sheets with valid headers without inventing patients", () => {
    const source = sheetFixture([]);
    source.rows.push({ row: 2, cells: [] });
    expect(mapSheet(source).resources.patients).toEqual([]);
  });
});
