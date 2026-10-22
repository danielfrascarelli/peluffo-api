import { JsonDataAccessor } from "@/data/json-data.accessor";
import { emptyResources, type Patient, type Resources } from "@/data/resources.types";
import { StatisticsService } from "@/modules/statistics/statistics.service";
import { ageDistribution } from "@/modules/statistics/age-distribution";
import { departmentDistribution } from "@/modules/statistics/department-distribution";
import { cumulativePatients } from "@/modules/statistics/cumulative-patients";
import { lastTwelveMonths, localDate } from "@/modules/statistics/statistics-period";

function patient(fields: Partial<Patient> = {}): Patient {
  return { id: "p1", cedula: "12345678", assignmentStatus: "pending", ...fields };
}

function statistics(resources: Resources): ReturnType<StatisticsService["getStatistics"]> {
  const current = jest.fn(() => resources);
  const service = new StatisticsService({ current } as unknown as JsonDataAccessor);
  const result = service.getStatistics();
  expect(current).toHaveBeenCalledTimes(1);
  return result;
}

describe("statistics", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-10-21T15:00:00.000Z")));
  afterEach(() => jest.useRealTimers());

  it("returns zero measured counts but unavailable sex and clinical completion for empty data", () => {
    const result = statistics(emptyResources());
    expect(result.totalPatients).toBe(0);
    expect(result.summary).toEqual({
      activePatients: 0,
      waitingPatients: 0,
      assignedThisMonth: 0,
      finishedThisMonth: null,
      finishedUnavailableReason: "TREATMENT_END_NOT_COLLECTED",
    });
    expect(result.cumulativePatients.data).toHaveLength(12);
    expect(result.cumulativePatients.data.every(({ total }) => total === 0)).toBe(true);
    expect(result.ageDistribution.data.map(({ count }) => count)).toEqual([0, 0, 0, 0, 0]);
    expect(result.sexDistribution).toEqual({
      available: false,
      reason: "SEX_NOT_COLLECTED",
      data: [],
      missingCount: 0,
    });
    expect(result.departmentDistribution).toEqual({ basis: "derived_from_city", data: [], unresolvedCount: 0 });
  });

  it("counts distinct patients assigned this month including closed history, never inferring discharge", () => {
    const resources: Resources = {
      patients: [patient({ assignmentStatus: "assigned" }), patient({ id: "p2", cedula: "2" })],
      psychologists: [],
      assignments: [
        {
          id: "a1",
          patientId: "p1",
          psychologistId: "ps1",
          startDate: "2026-10-01",
          closedObservedAt: "2026-10-02T03:00:00Z",
        },
        { id: "a2", patientId: "p1", psychologistId: "ps2", startDate: "2026-10-21" },
        {
          id: "a3",
          patientId: "p2",
          psychologistId: "ps2",
          startDate: "2026-10-05",
          closedObservedAt: "2026-10-06T03:00:00Z",
        },
        { id: "a4", patientId: "p1", psychologistId: "ps3", startDate: "2026-10-22" },
        { id: "a5", patientId: "p1", psychologistId: "ps4", startDate: "2026-09-30" },
      ],
    };
    expect(statistics(resources).summary).toMatchObject({
      activePatients: 1,
      waitingPatients: 1,
      assignedThisMonth: 2,
      finishedThisMonth: null,
    });
  });

  it("uses Montevideo month/year boundaries and does not shift date-only assignment dates", () => {
    jest.setSystemTime(new Date("2027-01-01T02:59:59.000Z"));
    const resources = emptyResources();
    resources.assignments = [
      { id: "a1", patientId: "p1", psychologistId: "ps1", startDate: "2026-12-01" },
      { id: "a2", patientId: "p2", psychologistId: "ps1", startDate: "2027-01-01" },
    ];
    expect(statistics(resources)).toMatchObject({ month: "2026-12", summary: { assignedThisMonth: 1 } });
    jest.setSystemTime(new Date("2027-01-01T03:00:00.000Z"));
    expect(statistics(resources)).toMatchObject({ month: "2027-01", summary: { assignedThisMonth: 1 } });
    expect(localDate("2026-10-01")).toBe("2026-10-01");
    expect(lastTwelveMonths("2027-01")).toEqual([
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });

  it("carries older requests forward, uses current corrected submission dates and excludes future instants", () => {
    const patients = [
      patient({ submittedAt: "2020-01-01T03:00:00Z" }),
      patient({ submittedAt: "2025-12-01T02:59:59Z" }),
      patient({ submittedAt: "2026-01-01T03:00:00Z" }),
      patient({ submittedAt: "2026-10-21T15:00:00Z" }),
      patient({ submittedAt: "2026-10-21T15:00:01Z" }),
      patient({ submittedAt: "2026-11-01T03:00:00Z" }),
      patient(),
    ];
    const result = cumulativePatients(patients, new Date(), "2026-10");
    expect(result.data.map(({ total }) => total)).toEqual([2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4]);
    expect(result).toMatchObject({ missingDateCount: 1, futureDateCount: 2 });
    patients[2]!.submittedAt = "2026-10-01T03:00:00Z";
    expect(cumulativePatients(patients, new Date(), "2026-10").data[2]!.total).toBe(2);
  });

  it("estimates age using whole twelve-month periods and accounts for unavailable references", () => {
    const result = ageDistribution(
      [
        patient({ age: 40, ageRecordedAt: "2024-01-15T03:00:00Z" }),
        patient({ age: 18, ageRecordedAt: "2025-10-31T03:00:00Z" }),
        patient({ age: 25, ageRecordedAt: "2025-11-01T03:00:00Z" }),
        patient({ age: 35, ageRecordedAt: "2025-10-01T03:00:00Z" }),
        patient({ age: 50, ageRecordedAt: "2025-10-01T03:00:00Z" }),
        patient({ age: 0, ageRecordedAt: "2026-10-30T03:00:00Z" }),
        patient({ age: 25, submittedAt: "2024-01-01T03:00:00Z" }),
        patient({ age: 25, ageRecordedAt: "2026-11-01T03:00:00Z" }),
        patient({ ageRecordedAt: "2024-01-01T03:00:00Z" }),
      ],
      "2026-10",
    );
    expect(result).toEqual({
      basis: "estimated",
      asOfMonth: "2026-10",
      data: [
        { key: "le18", count: 1 },
        { key: "19_25", count: 2 },
        { key: "26_35", count: 0 },
        { key: "36_50", count: 2 },
        { key: "gt50", count: 1 },
      ],
      missingCount: 3,
    });
    const reference = "2024-11-01T02:59:59Z"; // October in Montevideo.
    expect(ageDistribution([patient({ age: 18, ageRecordedAt: reference })], "2025-10").data[1]!.count).toBe(1);
  });

  it.each([
    [18, "le18"],
    [19, "19_25"],
    [25, "19_25"],
    [26, "26_35"],
    [35, "26_35"],
    [36, "36_50"],
    [50, "36_50"],
    [51, "gt50"],
  ])("puts declared age %i into %s without an elapsed year", (age, key) => {
    const result = ageDistribution([patient({ age, ageRecordedAt: "2026-10-01T03:00:00Z" })], "2026-10");
    expect(result.data.find((bucket) => bucket.key === key)?.count).toBe(1);
  });

  it("resolves official localities conservatively, without guessing from ambiguous names or free text", () => {
    const cities = [
      " Montevideo. ",
      "MONTEVIDEO",
      "San  José de Mayo",
      "san carlos",
      "Salto.",
      "Salto",
      "Dolores",
      "Mercedes",
      "Carmelo, personal comments",
      "Rural",
      "La Paz",
      undefined,
    ];
    const result = departmentDistribution(cities.map((city) => patient({ city })));
    expect(result).toEqual({
      basis: "derived_from_city",
      data: [
        { department: "Montevideo", count: 2 },
        { department: "Salto", count: 2 },
        { department: "Soriano", count: 2 },
        { department: "Maldonado", count: 1 },
        { department: "San José", count: 1 },
        { department: null, count: 4 },
      ],
      unresolvedCount: 4,
    });
    expect(JSON.stringify(result)).not.toMatch(/Carmelo|personal comments/);
  });

  it("does not mutate the published resources or expose patient or clinical details", () => {
    const resources = emptyResources();
    resources.patients = [patient({ fullName: "Private Patient", motive: "Private Clinical Reason" })];
    const before = structuredClone(resources);
    const result = statistics(resources);
    expect(resources).toEqual(before);
    expect(JSON.stringify(result)).not.toMatch(/Private|cedula|fullName|motive|patientId/);
    expect(result.totalPatients).toBe(1);
    expect(result.sexDistribution.missingCount).toBe(1);
  });
});
