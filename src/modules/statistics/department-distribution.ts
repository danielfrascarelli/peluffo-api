import { INE_LOCALITIES } from "@/data/ine-localities";
import type { Patient } from "@/data/resources.types";
import type { DepartmentDistributionDto } from "@/modules/statistics/dto/department-distribution.dto";

function normalizeCity(city: string): string {
  return city
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\.+$/u, "")
    .trim()
    .replace(/\s+/gu, " ");
}

function localityIndex(): Map<string, string | null> {
  const index = new Map<string, string | null>();
  for (const [department, localities] of INE_LOCALITIES) {
    for (const locality of localities) {
      const key = normalizeCity(locality);
      const previous = index.get(key);
      index.set(key, previous === undefined || previous === department ? department : null);
    }
  }
  return index;
}

const DEPARTMENT_BY_CITY = localityIndex();

export function departmentDistribution(patients: Patient[]): DepartmentDistributionDto {
  const counts = new Map<string, number>();
  let unresolvedCount = 0;
  for (const patient of patients) {
    const department = DEPARTMENT_BY_CITY.get(normalizeCity(patient.city ?? ""));
    if (department) counts.set(department, (counts.get(department) ?? 0) + 1);
    else unresolvedCount++;
  }
  const data: DepartmentDistributionDto["data"] = [...counts]
    .sort(([first, a], [second, b]) => b - a || first.localeCompare(second, "es-UY"))
    .map(([department, count]) => ({ department, count }));
  if (unresolvedCount) data.push({ department: null, count: unresolvedCount });
  return { basis: "derived_from_city", data, unresolvedCount };
}
