import type { Patient } from "@/data/resources.types";
import type { AgeDistributionDto } from "@/modules/statistics/dto/age-distribution.dto";
import { localDate, monthIndex } from "@/modules/statistics/statistics-period";

const AGE_GROUPS = [
  { key: "le18", maximum: 18 },
  { key: "19_25", maximum: 25 },
  { key: "26_35", maximum: 35 },
  { key: "36_50", maximum: 50 },
  { key: "gt50", maximum: Infinity },
];

export function ageDistribution(patients: Patient[], month: string): AgeDistributionDto {
  const data = AGE_GROUPS.map(({ key }) => ({ key, count: 0 }));
  let missingCount = 0;
  for (const patient of patients) {
    const elapsedMonths = patient.ageRecordedAt
      ? monthIndex(month) - monthIndex(localDate(patient.ageRecordedAt).slice(0, 7))
      : -1;
    if (patient.age === undefined || elapsedMonths < 0) {
      missingCount++;
      continue;
    }
    const estimatedAge = patient.age + Math.floor(elapsedMonths / 12);
    const group = AGE_GROUPS.findIndex(({ maximum }) => estimatedAge <= maximum);
    data[group]!.count++;
  }
  return { basis: "estimated", asOfMonth: month, data, missingCount };
}
