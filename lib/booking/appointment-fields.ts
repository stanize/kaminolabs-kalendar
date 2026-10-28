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
