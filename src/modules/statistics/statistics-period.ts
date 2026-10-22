export const STATISTICS_TIME_ZONE = "America/Montevideo";

const localDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: STATISTICS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function localDate(value: string | Date): string {
  // Assignment dates are local calendar dates, not UTC instants.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = localDateFormat.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((entry) => entry.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function monthIndex(month: string): number {
  const [year, number] = month.split("-").map(Number);
  return year! * 12 + number! - 1;
}

export function lastTwelveMonths(currentMonth: string): string[] {
  const last = monthIndex(currentMonth);
  return Array.from({ length: 12 }, (_, offset) => {
    const index = last - 11 + offset;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
  });
}
