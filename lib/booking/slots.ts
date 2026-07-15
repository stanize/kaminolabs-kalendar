import "server-only";
import type { DayId } from "@/lib/onboarding/types";

/**
 * Slot-generation engine for the public booking page.
 *
 * Given a business's weekly hours, a service duration, an existing set of taken
 * intervals, and a booking window, it produces the bookable slot start times for
 * a given day.
 *
 * Timezone: the business operates in Europe/Madrid for now (future: derived from
 * the business location). All slot instants are computed as UTC Date objects
 * that correspond to the intended Madrid wall-clock time.
 *
 * Slot stepping: slots step by the SERVICE duration (a 60-min service in
 * 09:00-12:00 yields 09:00, 10:00, 11:00), per the agreed model.
 */

export const BUSINESS_TZ = "Europe/Madrid";

export interface TimeRange {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export interface TakenInterval {
  start: Date; // UTC instant
  end: Date; // UTC instant
}

export interface Slot {
  start: Date; // UTC instant of the slot start
  end: Date; // UTC instant of the slot end
  label: string; // "HH:MM" in business tz, for display
}

const WEEKDAY_INDEX_TO_DAYID: DayId[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** The DayId (mon..sun) for a given instant, evaluated in the business tz. */
export function dayIdInTz(date: Date, tz: string = BUSINESS_TZ): DayId {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  const map: Record<string, DayId> = {
    Sun: "sun", Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat",
  };
  return map[wd] ?? "mon";
}

/**
 * Returns the UTC instant corresponding to a given Madrid wall-clock date+time.
 * yearMonthDay are the calendar date in the business tz; hh:mm the wall time.
 * Handles DST by resolving the offset for that specific instant.
 */
export function zonedTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hh: number,
  mm: number,
  tz: string = BUSINESS_TZ
): Date {
  // Start from a UTC guess, then correct by the tz offset at that moment.
  const utcGuess = Date.UTC(year, month - 1, day, hh, mm, 0);
  const asUtc = new Date(utcGuess);
  // What wall-clock time does this UTC instant show in tz?
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(asUtc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shownUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offset = shownUtc - utcGuess; // tz offset in ms at this instant
  return new Date(utcGuess - offset);
}

function hm(t: string): [number, number] {
  const [h, m] = t.split(":").map(Number);
  return [h, m];
}

/** "HH:MM" label in the business tz for a UTC instant. */
function labelInTz(date: Date, tz: string = BUSINESS_TZ): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Generates bookable slots for a single calendar day (in the business tz).
 *
 * @param dateInTz  a {year, month (1-12), day} identifying the calendar day in tz
 * @param ranges    the business's working intervals for that weekday
 * @param durationMin  the selected service duration — controls the actual
 *   appointment length (and therefore what counts as "taken"/blocked)
 * @param stepMin   the interval between offered start times, e.g. 09:00,
 *   10:00, 11:00... Deliberately independent from durationMin: a 45-minute
 *   service still only offers slots on the hour by default, so a following
 *   60-minute service booked right after it doesn't get squeezed into a
 *   45-minute gap. Defaults to 60. Not yet clinic-configurable — flagged as
 *   a likely future per-business setting.
 * @param taken     existing taken intervals (active bookings) as UTC instants
 * @param now       current instant (slots starting in the past are excluded)
 */
export function generateSlotsForDay(params: {
  dateInTz: { year: number; month: number; day: number };
  ranges: TimeRange[];
  durationMin: number;
  stepMin?: number;
  taken: TakenInterval[];
  now: Date;
  tz?: string;
}): Slot[] {
  const { dateInTz, ranges, durationMin, taken, now, tz = BUSINESS_TZ } = params;
  const stepMin = params.stepMin ?? 60;
  const slots: Slot[] = [];
  const stepMs = stepMin * 60_000;
  const durationMs = durationMin * 60_000;

  for (const range of ranges) {
    const [sh, sm] = hm(range.start);
    const [eh, em] = hm(range.end);
    const rangeStart = zonedTimeToUtc(dateInTz.year, dateInTz.month, dateInTz.day, sh, sm, tz);
    const rangeEnd = zonedTimeToUtc(dateInTz.year, dateInTz.month, dateInTz.day, eh, em, tz);

    for (let t = rangeStart.getTime(); t + durationMs <= rangeEnd.getTime() + 1; t += stepMs) {
      const slotStart = new Date(t);
      const slotEnd = new Date(t + durationMs);
      if (slotStart < now) continue; // no past slots
      const isTaken = taken.some((iv) => overlaps(slotStart, slotEnd, iv.start, iv.end));
      if (isTaken) continue;
      slots.push({ start: slotStart, end: slotEnd, label: labelInTz(slotStart, tz) });
    }
  }

  // De-dup + sort (split ranges can't overlap, but be safe).
  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return slots;
}

/** Calendar date {year, month, day} for an instant, evaluated in tz. */
export function tzDateParts(date: Date, tz: string = BUSINESS_TZ): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export { WEEKDAY_INDEX_TO_DAYID };
