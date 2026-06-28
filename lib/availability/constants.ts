import type { DayId } from "@/lib/onboarding/types";
import { DAYS } from "@/lib/onboarding/data";

/** Ordered weekday codes for the editor (mon..sun). */
export const WEEKDAY_ORDER: DayId[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Spanish label for a weekday code, from the shared DAYS map. */
export function weekdayLabel(day: DayId): string {
  return DAYS.find((d) => d.id === day)?.label ?? day;
}

/** Time-of-day options for the dropdowns: 00:00..23:45 in 15-min steps ("HH:MM"). */
export const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += 15) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return out;
})();

export const DEFAULT_RANGE_START = "08:00"; // first range of a day defaults here
export const TIME_STEP_MINUTES = 15;

export const BOOKING_WINDOW_OPTIONS = [1, 2, 3] as const;
export type BookingWindowMonths = (typeof BOOKING_WINDOW_OPTIONS)[number];

/** "HH:MM" -> minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Adds minutes to an "HH:MM", clamped to 23:45. */
export function addMinutes(hhmm: string, delta: number): string {
  const total = Math.min(toMinutes(hhmm) + delta, 23 * 60 + 45);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface TimeRange {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export type DayValidation =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validates a day's ranges: each end after start, and no overlaps. UI-facing
 * errors in Spanish. Empty list (closed day) is valid.
 */
export function validateDayRanges(ranges: TimeRange[]): DayValidation {
  for (const r of ranges) {
    if (toMinutes(r.end) <= toMinutes(r.start)) {
      return { valid: false, error: "La hora de fin debe ser posterior a la de inicio." };
    }
  }
  const sorted = [...ranges].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].end)) {
      return { valid: false, error: "Los horarios de un mismo día no pueden solaparse." };
    }
  }
  return { valid: true };
}
