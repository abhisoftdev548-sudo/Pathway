import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/** Returns the user's local calendar date as YYYY-MM-DD. */
export function localDateString(date: Date, timeZone: string): string {
  try {
    return formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
  } catch {
    return formatInTimeZone(date, 'UTC', 'yyyy-MM-dd');
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function zonedStartOfDay(date: Date, timeZone: string): Date {
  const zoned = toZonedTime(date, timeZone);
  zoned.setHours(0, 0, 0, 0);
  // Approximation: use the zone offset at noon to avoid DST boundary issues.
  const offset =
    new Date(formatInTimeZone(zoned, timeZone, "yyyy-MM-dd'T'HH:mm:ss")).getTime() - zoned.getTime();
  return new Date(zoned.getTime() - offset);
}

export function addDaysToDateString(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayString(timeZone: string, now = new Date()): string {
  return localDateString(now, timeZone);
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function differenceInCalendarDays(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00.000Z`).getTime();
  const db = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.round((da - db) / DAY_MS);
}
