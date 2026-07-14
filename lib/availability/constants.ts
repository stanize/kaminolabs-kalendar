import type { DayId } from "@/lib/onboarding/types";

/** Ordered weekday codes for the editor (mon..sun). */
export const WEEKDAY_ORDER: DayId[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

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

/** The translation slice validateDayRanges needs. Keeps this module free of
 *  any hardcoded language — callers supply the words via this shape, sourced
 *  from lib/i18n/dictionaries/availability.ts's `validation` section. */
export interface DayRangesValidationDict {
  errEndBeforeStart: string;
  errOverlap: string;
}

/**
 * Validates a day's ranges: each end after start, and no overlaps. `dict`
 * supplies the UI-facing reason text. Empty list (closed day) is valid.
 */
export function validateDayRanges(ranges: TimeRange[], dict: DayRangesValidationDict): DayValidation {
  for (const r of ranges) {
    if (toMinutes(r.end) <= toMinutes(r.start)) {
      return { valid: false, error: dict.errEndBeforeStart };
    }
  }
  const sorted = [...ranges].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].end)) {
      return { valid: false, error: dict.errOverlap };
    }
  }
  return { valid: true };
}

/**
 * First-time setup wizard defaults (statistically likely Spanish schedule):
 * Mon–Fri open, jornada partida 09:00–13:00 / 14:00–18:00. The wizard fans
 * these out to each selected day at the review step — after that every day is
 * independent (no linked template).
 */
export const SETUP_DEFAULT_DAYS: DayId[] = ["mon", "tue", "wed", "thu", "fri"];
export const SETUP_DEFAULT_RANGES: TimeRange[] = [
  { start: "09:00", end: "13:00" },
  { start: "14:00", end: "18:00" },
];
