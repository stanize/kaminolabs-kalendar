import { TZ } from "@/lib/calendar/client-date";

// Shared by AppointmentModal (create/edit side panel) and the inline edit
// fields in BookingDetailModal — pure view-model types + helpers, no
// component state. Kept here instead of duplicated in both files.

export interface ServiceVM {
  id: string;
  name: string;
  durationMin: number;
  price: number;
}

export interface MemberVM {
  id: string;
  name: string;
}

export interface TimeRangeVM {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export function toMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

// time-field-loose-input: the Hora field accepts free typing ("9", "9:00",
// "9:5") but every downstream check (timeValid, overlap detection, the
// suggested-times list) requires the strict "HH:MM" shape — without this,
// typing "9:00" (no leading zero) silently skipped the conflict warning
// entirely, since timeValid was false. Called on blur, not on every
// keystroke, so the field doesn't fight the user mid-type.
export function normalizeTimeInput(raw: string): string {
  const s = raw.trim();
  const m = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (!m) return s;
  const hh = m[1].padStart(2, "0");
  const mm = (m[2] ?? "00").padStart(2, "0");
  return `${hh}:${mm}`;
}

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function hhmmFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

/** Every hourly slot across a day's working-hours ranges — offered in the
 * time field's dropdown as a convenience, not a restriction: the field
 * itself accepts any typed value too, in or out of business hours. */
export function buildSuggestedTimes(ranges: TimeRangeVM[]): string[] {
  const times: string[] = [];
  for (const r of ranges) {
    const [sh, sm] = r.start.split(":").map(Number);
    const [eh, em] = r.end.split(":").map(Number);
    let t = sh * 60 + sm;
    const end = eh * 60 + em;
    while (t < end) {
      times.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
      t += 60;
    }
  }
  return times;
}

// custom-time-slots (workflows/custom-time-slots.md) — a client-safe
// projection of CustomTimeSlotRule (lib/custom-slots/data.ts), same shape
// as ClosureRuleVM elsewhere: just what the booking form needs.
export interface CustomTimeSlotRuleVM {
  days: string[]; // DayId[], empty = every open day
  teamMemberIds: string[]; // empty = all providers
  times: string[]; // "HH:MM"
}

/** Additive, opt-in on top of buildSuggestedTimes above — returns the
 * union of every matching rule's times for this (day, provider), or null
 * when nothing matches (caller falls back to buildSuggestedTimes,
 * completely unchanged from before this feature existed). */
export function resolveCustomSuggestedTimes(
  rules: CustomTimeSlotRuleVM[],
  dayId: string,
  teamMemberId: string
): string[] | null {
  const matching = rules.filter(
    (r) =>
      (r.days.length === 0 || r.days.includes(dayId)) &&
      (r.teamMemberIds.length === 0 || r.teamMemberIds.includes(teamMemberId))
  );
  if (matching.length === 0) return null;
  const union = new Set<string>();
  for (const r of matching) for (const t of r.times) union.add(t);
  return [...union];
}

/** Non-blocking "is this time actually within the day's working hours" —
 * used to flag (never block/remove) a custom-slot suggestion that falls
 * outside Horarios, both in the rule editor and the booking form's own
 * dropdown. */
export function isOutsideBusinessHours(time: string, ranges: TimeRangeVM[]): boolean {
  const mins = toMinutes(time);
  return !ranges.some((r) => mins >= toMinutes(r.start) && mins < toMinutes(r.end));
}
