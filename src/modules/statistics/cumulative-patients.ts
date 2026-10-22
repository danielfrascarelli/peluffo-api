import type { Patient } from "@/data/resources.types";
import type { CumulativePatientsDto } from "@/modules/statistics/dto/cumulative-patients.dto";
import { lastTwelveMonths, localDate } from "@/modules/statistics/statistics-period";

export function cumulativePatients(patients: Patient[], now: Date, month: string): CumulativePatientsDto {
  const increments = new Map(lastTwelveMonths(month).map((key) => [key, 0]));
  const firstMonth = increments.keys().next().value!;
  let missingDateCount = 0;
  let futureDateCount = 0;
  for (const patient of patients) {
    if (!patient.submittedAt) {
      missingDateCount++;
      continue;
    }
    if (new Date(patient.submittedAt).getTime() > now.getTime()) {
      futureDateCount++;
      continue;
    }
    const submittedMonth = localDate(patient.submittedAt).slice(0, 7);
    const bucket = submittedMonth < firstMonth ? firstMonth : submittedMonth;
    increments.set(bucket, increments.get(bucket)! + 1);
  }
  let total = 0;
  const data = [...increments].map(([key, count]) => {
    total += count;
    return { month: key, total };
  });
  return { data, missingDateCount, futureDateCount };
}
