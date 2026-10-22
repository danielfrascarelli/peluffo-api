import { Injectable } from "@nestjs/common";
import { JsonDataAccessor } from "@/data/json-data.accessor";
import { StatisticsDto } from "@/modules/statistics/dto/statistics.dto";
import { cumulativePatients } from "@/modules/statistics/cumulative-patients";
import { ageDistribution } from "@/modules/statistics/age-distribution";
import { departmentDistribution } from "@/modules/statistics/department-distribution";
import { localDate, STATISTICS_TIME_ZONE } from "@/modules/statistics/statistics-period";

@Injectable()
export class StatisticsService {
  constructor(private readonly data: JsonDataAccessor) {}

  getStatistics(): StatisticsDto {
    const now = new Date();
    const today = localDate(now);
    const month = today.slice(0, 7);
    const { patients, assignments } = this.data.current();
    const activePatients = patients.filter((patient) => patient.assignmentStatus === "assigned").length;
    const assignedPatients = new Set(
      assignments
        .filter(({ startDate }) => {
          const date = localDate(startDate);
          return date.startsWith(month) && date <= today;
        })
        .map(({ patientId }) => patientId),
    );
    return {
      generatedAt: now.toISOString(),
      timeZone: STATISTICS_TIME_ZONE,
      month,
      totalPatients: patients.length,
      summary: {
        activePatients,
        waitingPatients: patients.length - activePatients,
        assignedThisMonth: assignedPatients.size,
        finishedThisMonth: null,
        finishedUnavailableReason: "TREATMENT_END_NOT_COLLECTED",
      },
      cumulativePatients: cumulativePatients(patients, now, month),
      ageDistribution: ageDistribution(patients, month),
      sexDistribution: { available: false, reason: "SEX_NOT_COLLECTED", data: [], missingCount: patients.length },
      departmentDistribution: departmentDistribution(patients),
    };
  }
}
