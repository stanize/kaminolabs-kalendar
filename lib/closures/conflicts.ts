import "server-only";
import { createClient } from "@/lib/supabase/server";
import { zonedTimeToUtc, tzDateParts, BUSINESS_TZ } from "@/lib/booking/slots";
import type { BusinessClosure } from "@/lib/closures/data";

/**
 * Shared overlap-detection between a business closure (recurring festivo or
 * one-off provider time off) and existing `kalendar_bookings` rows. Used by
 * BOTH:
 *  - the pre-save conflict check (existing-bookings-conflict-alert): does a
 *    closure the clinic is ABOUT to save overlap any existing booking?
 *  - the Conflictos tab (conflicts-tab): a live, derived scan of every
 *    CURRENTLY-saved closure against currently-active bookings.
 * Kept as one implementation so "does this booking fall inside this
 * closure" is never answered two different ways in the codebase.
 */

export interface ClosureInput {
  recurring: boolean;
  month?: number | null;
  day?: number | null;
  startDate?: string | null; // "YYYY-MM-DD"
  endDate?: string | null; // "YYYY-MM-DD"
  startTime?: string | null; // "HH:MM" (or "HH:MM:SS" from the DB — sliced)
  endTime?: string | null;
  teamMemberId?: string | null;
}

export interface ConflictingBooking {
  id: string;
  clientName: string;
  serviceName: string;
  startIso: string;
  teamMemberId: string | null;
  providerName: string | null;
}

function hm(t: string): [number, number] {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return [h, m];
}

/**
 * The concrete [start, end) UTC windows a closure definition covers, up to
 * (and excluding) `horizonEnd`. A recurring festivo expands to one window
 * per year from "now" through the booking window horizon (per Arun's
 * decision — nothing can be booked further out than that, so there's no
 * point checking beyond it). A one-off closure is a single window (or, for
 * a same-day partial-hours entry, a same-day time-bounded window).
 */
export function closureDateWindows(
  closure: ClosureInput,
  horizonEnd: Date
): { start: Date; end: Date }[] {
  if (closure.recurring) {
    if (!closure.month || !closure.day) return [];
    const now = new Date();
    const startYear = tzDateParts(now, BUSINESS_TZ).year;
    const horizonYear = tzDateParts(horizonEnd, BUSINESS_TZ).year;
    const windows: { start: Date; end: Date }[] = [];
    for (let y = startYear; y <= horizonYear; y++) {
      const start = zonedTimeToUtc(y, closure.month, closure.day, 0, 0);
      if (start >= horizonEnd) continue;
      const end = zonedTimeToUtc(y, closure.month, closure.day + 1, 0, 0); // JS Date normalizes day overflow
      windows.push({ start, end });
    }
    return windows;
  }

  if (!closure.startDate || !closure.endDate) return [];
  const [y1, m1, d1] = closure.startDate.split("-").map(Number);
  const [y2, m2, d2] = closure.endDate.split("-").map(Number);

  if (closure.startTime && closure.endTime) {
    const [sh, sm] = hm(closure.startTime);
    const [eh, em] = hm(closure.endTime);
    return [
      { start: zonedTimeToUtc(y1, m1, d1, sh, sm), end: zonedTimeToUtc(y1, m1, d1, eh, em) },
    ];
  }

  return [
    { start: zonedTimeToUtc(y1, m1, d1, 0, 0), end: zonedTimeToUtc(y2, m2, d2 + 1, 0, 0) },
  ];
}

/** True if `closure` is scoped in a way that covers `teamMemberId` (a booking's provider). */
function closureCoversProvider(closure: ClosureInput, teamMemberId: string | null): boolean {
  if (!closure.teamMemberId) return true; // clinic-wide — covers every provider
  return closure.teamMemberId === teamMemberId;
}

/** Cap on how many affected bookings a caller shows before "+N more". */
export const CONFLICT_LIST_CAP = 8;

/**
 * Finds existing active (pending_confirmation/confirmed) bookings that
 * overlap the given closure definition, within `horizonEnd` (the business's
 * booking-window horizon for a recurring festivo — irrelevant for a one-off
 * closure, which already carries its own real date range).
 */
export async function findConflictingBookings(
  businessId: string,
  closure: ClosureInput,
  horizonEnd: Date
): Promise<ConflictingBooking[]> {
  const windows = closureDateWindows(closure, horizonEnd);
  if (windows.length === 0) return [];

  const supabase = await createClient();
  const overallStart = windows.reduce((min, w) => (w.start < min ? w.start : min), windows[0].start);
  const overallEnd = windows.reduce((max, w) => (w.end > max ? w.end : max), windows[0].end);

  let query = supabase
    .from("kalendar_bookings")
    .select("id, client_name, service_name, starts_at, team_member_id")
    .eq("business_id", businessId)
    .in("status", ["pending_confirmation", "confirmed"])
    .gte("starts_at", overallStart.toISOString())
    .lt("starts_at", overallEnd.toISOString())
    .order("starts_at", { ascending: true });

  if (closure.teamMemberId) {
    query = query.eq("team_member_id", closure.teamMemberId);
  }

  const { data } = await query;
  const rows =
    (data as { id: string; client_name: string; service_name: string; starts_at: string; team_member_id: string | null }[] | null) ??
    [];

  // The DB query above already narrows by the overall span (and provider,
  // when scoped) — re-check each row against the exact per-year windows
  // (a multi-year recurring festivo has gaps between its yearly windows
  // that a single [overallStart, overallEnd) range query can't express) and
  // against closureCoversProvider (belt-and-braces, matches the DB filter).
  const matches = rows.filter((b) => {
    const startsAt = new Date(b.starts_at);
    const inAnyWindow = windows.some((w) => startsAt >= w.start && startsAt < w.end);
    return inAnyWindow && closureCoversProvider(closure, b.team_member_id);
  });

  if (matches.length === 0) return [];

  const memberIds = [...new Set(matches.map((b) => b.team_member_id).filter((id): id is string => !!id))];
  const memberNames = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data: members } = await supabase
      .from("kalendar_team_members")
      .select("id, name")
      .in("id", memberIds);
    for (const m of (members as { id: string; name: string }[] | null) ?? []) {
      memberNames.set(m.id, m.name);
    }
  }

  return matches.map((b) => ({
    id: b.id,
    clientName: b.client_name,
    serviceName: b.service_name,
    startIso: b.starts_at,
    teamMemberId: b.team_member_id,
    providerName: b.team_member_id ? memberNames.get(b.team_member_id) ?? null : null,
  }));
}

/**
 * Converts a stored BusinessClosure row into the shared ClosureInput shape.
 * Exported so the availability engine (`lib/actions/booking.ts`) can reuse
 * the same expansion (`closureDateWindows`) it's built on, rather than
 * re-deriving this mapping a second time.
 */
export function toClosureInput(c: BusinessClosure): ClosureInput {
  return {
    recurring: c.recurring,
    month: c.month,
    day: c.day,
    startDate: c.start_date,
    endDate: c.end_date,
    startTime: c.start_time,
    endTime: c.end_time,
    teamMemberId: c.team_member_id,
  };
}

export interface CurrentConflict {
  booking: ConflictingBooking;
  closureId: string;
  closureLabel: string;
}

/**
 * The Conflictos tab's data: for every currently-saved closure, every
 * currently-active booking it overlaps — fully derived, computed fresh on
 * every call (no stored "resolved" flag). One booking can appear once per
 * closure it conflicts with (rare in practice, but not deduplicated away —
 * each is a real, separate thing to know about).
 */
export async function getCurrentConflicts(
  businessId: string,
  bookingWindowMonths: number,
  closures: BusinessClosure[]
): Promise<CurrentConflict[]> {
  const horizonEnd = new Date();
  horizonEnd.setUTCMonth(horizonEnd.getUTCMonth() + bookingWindowMonths);

  const results: CurrentConflict[] = [];
  for (const closure of closures) {
    const input = toClosureInput(closure);
    const bookings = await findConflictingBookings(businessId, input, horizonEnd);
    for (const booking of bookings) {
      results.push({
        booking,
        closureId: closure.id,
        closureLabel: closureDisplayLabel(closure, booking.providerName),
      });
    }
  }
  return results.sort((a, b) => new Date(a.booking.startIso).getTime() - new Date(b.booking.startIso).getTime());
}

/**
 * Per-date festivo labels for a queried range — RECURRING, clinic-wide
 * closures only (never a one-off provider vacation/time-off: per Arun's
 * explicit "vacations should show as not available as others" decision,
 * those must render with the same generic unavailability messaging as any
 * other fully-booked/closed day). Reuses `closureDateWindows` (the same
 * yearly expansion the conflict-check/Conflictos-tab code already relies
 * on) rather than a second "does this date match a festivo" implementation.
 * Keyed by "YYYY-MM-DD" in the business tz; value is the closure's own
 * label, or `null` when it has none (caller applies its own generic
 * fallback copy, e.g. "Festivo").
 */
export function festivoLabelsForRange(
  closures: BusinessClosure[],
  horizonEnd: Date
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const c of closures) {
    if (!c.recurring) continue;
    const input = toClosureInput(c);
    for (const w of closureDateWindows(input, horizonEnd)) {
      const { year, month, day } = tzDateParts(w.start, BUSINESS_TZ);
      const ds = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      out[ds] = c.label || null;
    }
  }
  return out;
}

/**
 * "Navidad" / "Vacaciones de Ana" style label — the clinic's own label when
 * set, otherwise a sensible fallback: a provider-scoped one-off closure
 * without a custom label falls back to "Vacaciones de {provider}" (needs
 * `providerName`, resolved from the matched booking's own team_member_id,
 * which always equals the closure's when it's provider-scoped); anything
 * else falls back to its date.
 */
export function closureDisplayLabel(closure: BusinessClosure, providerName?: string | null): string {
  if (closure.label) return closure.label;
  if (closure.recurring) return `${closure.day}/${closure.month}`;
  if (closure.team_member_id && providerName) return `Vacaciones de ${providerName}`;
  return "Cierre";
}
