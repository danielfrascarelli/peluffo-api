import type { SheetCell } from "@/data/extraction.types";

const zone = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Montevideo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function localParts(date: Date): number[] {
  const parts = zone.formatToParts(date);
  return ["year", "month", "day", "hour", "minute", "second"].map((name) =>
    Number(parts.find((part) => part.type === name)?.value),
  );
}

function utcTime(parts: number[]): number {
  const [year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0] = parts;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.valueOf();
}

function wallParts(cell: SheetCell): number[] | undefined {
  const serial = cell.effectiveValue?.numberValue;
  if (serial !== undefined) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86_400) * 1_000);
    if (!Number.isFinite(date.valueOf())) return undefined;
    return [
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    ];
  }
  const value = cell.effectiveValue?.stringValue ?? cell.formattedValue ?? "";
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (!match) return undefined;
  return [
    Number(match[3]),
    Number(match[2]),
    Number(match[1]),
    Number(match[4] ?? 0),
    Number(match[5] ?? 0),
    Number(match[6] ?? 0),
  ];
}

export function sheetTimestamp(cell: SheetCell): string | undefined {
  const parts = wallParts(cell);
  if (!parts || parts[0]! < 1900 || parts[0]! > 9999) return undefined;
  const wall = utcTime(parts);
  let instant = wall;
  // Resolve the IANA-zone offset, then check round-trip to reject invalid calendar dates.
  for (let attempt = 0; attempt < 3; attempt++) {
    const difference = wall - utcTime(localParts(new Date(instant)));
    if (difference === 0) break;
    instant += difference;
  }
  if (!localParts(new Date(instant)).every((part, index) => part === parts[index])) return undefined;
  return new Date(instant).toISOString();
}

export function sheetDate(cell: SheetCell): string | undefined {
  const timestamp = sheetTimestamp(cell);
  if (!timestamp) return undefined;
  const [year, month, day] = localParts(new Date(timestamp));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
