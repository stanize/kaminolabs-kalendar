// Client-safe Madrid-tz date helpers for the panel calendar views (day/week/
// month grids + header). Deliberately NOT "server-only" — lib/booking/slots.ts
// has the server-side equivalents, but that file can't be imported into
// client components, so this is the shared client-side source of truth
// instead of duplicating the same Intl-based math per component.
import type { DayId } from "@/lib/onboarding/types";

export const TZ = "Europe/Madrid";
export const DAY_ORDER: DayId[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function tzDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function dayIdInTz(date: Date): DayId {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date);
  const map: Record<string, DayId> = {
    Sun: "sun", Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat",
  };
  return map[wd] ?? "mon";
}

export function zonedTimeToUtc(year: number, month: number, day: number, hh: number, mm: number): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hh, mm, 0);
  const asUtc = new Date(utcGuess);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(asUtc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shownUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offset = shownUtc - utcGuess;
  return new Date(utcGuess - offset);
}

export function minutesInTz(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** UTC instant for the Madrid-local 00:00 of the calendar day containing `date`. */
export function dayStart(date: Date): Date {
  const { year, month, day } = tzDateParts(date);
  return zonedTimeToUtc(year, month, day, 0, 0);
}

/** UTC instant for the Monday 00:00 (Madrid) of the week containing `date`. */
export function mondayStart(date: Date): Date {
  const dId = dayIdInTz(date);
  const idx = DAY_ORDER.indexOf(dId);
  const { year, month, day } = tzDateParts(date);
  // Anchor at UTC noon of the calendar day — stable across DST, safe to shift by whole days.
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() - idx);
  const mp = tzDateParts(anchor);
  return zonedTimeToUtc(mp.year, mp.month, mp.day, 0, 0);
}

/** UTC instant for the 1st of the Madrid-local month containing `date`. */
export function monthStart(date: Date): Date {
  const { year, month } = tzDateParts(date);
  return zonedTimeToUtc(year, month, 1, 0, 0);
}

/** Adds `n` whole days (Madrid-local) to a UTC instant, returned as a UTC instant. */
export function addDaysUtc(date: Date, n: number): Date {
  const anchor = new Date(date);
  anchor.setUTCHours(anchor.getUTCHours() + 12); // stable-noon trick for DST-safe day math
  anchor.setUTCDate(anchor.getUTCDate() + n);
  const { year, month, day } = tzDateParts(anchor);
  return zonedTimeToUtc(year, month, day, 0, 0);
}

/**
 * Adds `n` months (Madrid-local) to `date`, normalized to the 1st of the
 * resulting month at local noon. Navigation only needs the target
 * year/month, so anchoring to day 1 avoids day-overflow edge cases (e.g.
 * Jan 31 minus 1 month is not a real February date) and DST-transition
 * instants that raw setUTCMonth() on an arbitrary instant can land on
 * incorrectly.
 */
export function addMonthsInTz(date: Date, n: number): Date {
  const { year, month } = tzDateParts(date);
  const totalMonths = (year * 12 + (month - 1)) + n;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  return zonedTimeToUtc(targetYear, targetMonth, 1, 12, 0);
}

/**
 * [gridStartIso, gridEndIso) covering the full Monday-Sunday weeks needed to
 * display the Madrid-local month containing `date` in a 6-row grid (padded
 * with the trailing/leading days of adjacent months, Outlook/Google style).
 */
export function monthGridBounds(date: Date): { gridStart: Date; gridEnd: Date } {
  const first = monthStart(date);
  const gridStart = mondayStart(first);
  const gridEnd = addDaysUtc(gridStart, 42); // always 6 full weeks
  return { gridStart, gridEnd };
}
