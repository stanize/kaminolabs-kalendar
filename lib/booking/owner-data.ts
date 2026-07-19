import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import { getTeamForUser } from "@/lib/team/data";
import { getServicesForUser } from "@/lib/services/data";
import { dayIdInTz, tzDateParts, zonedTimeToUtc, BUSINESS_TZ } from "@/lib/booking/slots";
import type { DayId } from "@/lib/onboarding/types";
import type { TimeRange } from "@/lib/booking/slots";

export type BookingStatus = "pending_confirmation" | "confirmed" | "cancelled" | "completed";

export interface OwnerBooking {
  id: string;
  service_name: string;
  service_duration_min: number;
  service_price: number;
  team_member_id: string | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  pending_expiry_at: string | null;
  guest_locale: string | null;
}

export interface OwnerBookingWithProvider extends OwnerBooking {
  provider_name: string | null;
}

const BOOKING_COLUMNS =
  "id, service_name, service_duration_min, service_price, team_member_id, starts_at, ends_at, status, client_name, client_email, client_phone, pending_expiry_at, guest_locale";

/**
 * Bookings for the owner's business, scoped by userId via the owning business.
 * Returns upcoming (now-or-later) active bookings — pending + confirmed —
 * ordered chronologically, with the provider name resolved for team display.
 * Past and cancelled bookings are excluded from this view.
 */
export async function getUpcomingBookings(userId: string): Promise<OwnerBookingWithProvider[]> {
  const business = await getBusinessForUser(userId);
  if (!business) return [];

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [bookingsRes, membersRes] = await Promise.all([
    supabase
      .from("kalendar_bookings")
      .select(BOOKING_COLUMNS)
      .eq("business_id", business.id)
      .in("status", ["pending_confirmation", "confirmed"])
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true }),
    supabase
      .from("kalendar_team_members")
      .select("id, name")
      .eq("business_id", business.id),
  ]);

  const memberName = new Map(
    ((membersRes.data as { id: string; name: string }[] | null) ?? []).map((m) => [m.id, m.name])
  );

  return ((bookingsRes.data as OwnerBooking[] | null) ?? []).map((b) => ({
    ...b,
    provider_name: b.team_member_id ? memberName.get(b.team_member_id) ?? null : null,
  }));
}

// ── Week view (Outlook-style grid, one column per provider) ────────────────

export interface WeekViewMember {
  id: string;
  name: string;
  isOwner: boolean;
}

export interface WeekViewBooking {
  id: string;
  serviceName: string;
  startIso: string;
  endIso: string;
  durationMin: number;
  status: BookingStatus;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  teamMemberId: string | null;
  pendingExpiryAt: string | null;
  guestLocale: string | null;
}

export interface WeekViewService {
  id: string;
  name: string;
  durationMin: number;
  price: number;
}

export interface WeekCalendarData {
  members: WeekViewMember[];
  hoursByDay: Partial<Record<DayId, TimeRange[]>>;
  services: WeekViewService[];
  bookings: WeekViewBooking[];
}

function hhmm(t: string): string {
  return t.slice(0, 5);
}

async function getBusinessHoursByDay(
  businessId: string
): Promise<Partial<Record<DayId, TimeRange[]>>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_business_hours")
    .select("day, start_time, end_time, sort_order")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true });

  const hoursByDay: Partial<Record<DayId, TimeRange[]>> = {};
  for (const r of (data as { day: DayId; start_time: string; end_time: string }[] | null) ?? []) {
    (hoursByDay[r.day] ??= []).push({ start: hhmm(r.start_time), end: hhmm(r.end_time) });
  }
  return hoursByDay;
}

/**
 * Everything the week-grid calendar needs for the given [weekStart, weekEnd)
 * range (weekEnd exclusive): providers (always one column per team member,
 * solo businesses just have one), business hours (to size the grid + validate
 * manual bookings), services (for the "add appointment" form), and active
 * bookings (pending + confirmed) in range. Scoped by userId throughout.
 */
export async function getWeekCalendarData(
  userId: string,
  weekStartIso: string,
  weekEndIso: string
): Promise<WeekCalendarData | null> {
  const business = await getBusinessForUser(userId);
  if (!business) return null;

  const supabase = await createClient();

  const [membersRows, hoursByDay, servicesRows, bookingsRes] = await Promise.all([
    getTeamForUser(userId),
    getBusinessHoursByDay(business.id),
    getServicesForUser(userId),
    supabase
      .from("kalendar_bookings")
      .select(
        "id, service_name, service_duration_min, starts_at, ends_at, status, client_name, client_email, client_phone, team_member_id, pending_expiry_at, guest_locale"
      )
      .eq("business_id", business.id)
      .in("status", ["pending_confirmation", "confirmed"])
      .gte("starts_at", weekStartIso)
      .lt("starts_at", weekEndIso)
      .order("starts_at", { ascending: true }),
  ]);

  const bookings: WeekViewBooking[] = (
    (bookingsRes.data as
      | {
          id: string;
          service_name: string;
          service_duration_min: number;
          starts_at: string;
          ends_at: string;
          status: BookingStatus;
          client_name: string;
          client_email: string;
          client_phone: string | null;
          team_member_id: string | null;
          pending_expiry_at: string | null;
          guest_locale: string | null;
        }[]
      | null) ?? []
  ).map((b) => ({
    id: b.id,
    serviceName: b.service_name,
    startIso: b.starts_at,
    endIso: b.ends_at,
    durationMin: b.service_duration_min,
    status: b.status,
    clientName: b.client_name,
    clientEmail: b.client_email,
    clientPhone: b.client_phone,
    teamMemberId: b.team_member_id,
    pendingExpiryAt: b.pending_expiry_at,
    guestLocale: b.guest_locale,
  }));

  return {
    members: membersRows.map((m) => ({ id: m.id, name: m.name, isOwner: m.is_owner })),
    hoursByDay,
    services: servicesRows.map((s) => ({ id: s.id, name: s.name, durationMin: s.duration_min, price: s.price })),
    bookings,
  };
}

/**
 * Just the bookings for a [weekStart, weekEnd) range — used when the client
 * navigates to a different week (members/hours/services don't change
 * week-to-week, so only this needs refetching).
 */
export async function getWeekBookings(
  userId: string,
  weekStartIso: string,
  weekEndIso: string
): Promise<WeekViewBooking[]> {
  const data = await getWeekCalendarData(userId, weekStartIso, weekEndIso);
  return data?.bookings ?? [];
}

// ── Inicio/Calendar dashboard widgets: Hoy + Esta semana ────────────────────
//
// Both widgets count only active bookings (pending + confirmed), and both
// count what's still AHEAD from right now — not the day/week's original
// total — so the number counts down over the course of the day/week as
// appointments pass. When there's no time left in the current window
// (today's hours are done, or the whole week's hours are done), each widget
// rolls forward to the next window instead of showing a stale/zero count.

/** Advances a Madrid-tz calendar date by `n` days, DST-safe (noon-anchored). */
function addDaysInBusinessTz(year: number, month: number, day: number, n: number) {
  const noon = zonedTimeToUtc(year, month, day, 12, 0, BUSINESS_TZ);
  noon.setUTCDate(noon.getUTCDate() + n);
  return tzDateParts(noon, BUSINESS_TZ);
}

/** True if `ranges` (a day's business hours) has any time left after `now`. */
function hasTimeLeft(ranges: TimeRange[], year: number, month: number, day: number, now: Date): boolean {
  return ranges.some((r) => {
    const [eh, em] = r.end.split(":").map(Number);
    return zonedTimeToUtc(year, month, day, eh, em, BUSINESS_TZ) > now;
  });
}

async function countActiveBookings(businessId: string, fromUtc: Date, toUtc: Date): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("kalendar_bookings")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .in("status", ["pending_confirmation", "confirmed"])
    .gte("starts_at", fromUtc.toISOString())
    .lt("starts_at", toUtc.toISOString());
  return count ?? 0;
}

export interface HoyWidgetStats {
  isToday: boolean; // false once rolled forward to the next open day
  dateIso: string; // Madrid "YYYY-MM-DD" the count actually covers
  count: number;
}

/**
 * Hoy widget: active bookings remaining from right now through the end of
 * today. If today is closed, or today's hours have already ended, scans
 * forward (up to 14 days) for the next day with any open hours and returns
 * that day's full count instead (isToday: false).
 */
export async function getHoyWidgetStats(userId: string): Promise<HoyWidgetStats> {
  const business = await getBusinessForUser(userId);
  if (!business) return { isToday: true, dateIso: "", count: 0 };

  const now = new Date();
  const hoursByDay = await getBusinessHoursByDay(business.id);
  let cursor = tzDateParts(now, BUSINESS_TZ);

  for (let i = 0; i < 14; i++) {
    const dayId = dayIdInTz(zonedTimeToUtc(cursor.year, cursor.month, cursor.day, 12, 0, BUSINESS_TZ), BUSINESS_TZ);
    const ranges = hoursByDay[dayId] ?? [];
    if (hasTimeLeft(ranges, cursor.year, cursor.month, cursor.day, now)) {
      const windowStart = i === 0 ? now : zonedTimeToUtc(cursor.year, cursor.month, cursor.day, 0, 0, BUSINESS_TZ);
      const nextDay = addDaysInBusinessTz(cursor.year, cursor.month, cursor.day, 1);
      const windowEnd = zonedTimeToUtc(nextDay.year, nextDay.month, nextDay.day, 0, 0, BUSINESS_TZ);
      const count = await countActiveBookings(business.id, windowStart, windowEnd);
      const dateIso = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-${String(cursor.day).padStart(2, "0")}`;
      return { isToday: i === 0, dateIso, count };
    }
    cursor = addDaysInBusinessTz(cursor.year, cursor.month, cursor.day, 1);
  }

  // Nothing open in the next 14 days — fall back to today's (empty) window.
  const { year, month, day } = tzDateParts(now, BUSINESS_TZ);
  return { isToday: true, dateIso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, count: 0 };
}

/** True if any day from `weekStartIso` (Monday) through Sunday still has open business hours after `now`. */
function weekHasTimeLeft(
  hoursByDay: Partial<Record<DayId, TimeRange[]>>,
  weekStartIso: string,
  now: Date
): boolean {
  let cursor = tzDateParts(new Date(weekStartIso), BUSINESS_TZ);
  for (let i = 0; i < 7; i++) {
    const dayId = dayIdInTz(zonedTimeToUtc(cursor.year, cursor.month, cursor.day, 12, 0, BUSINESS_TZ), BUSINESS_TZ);
    const ranges = hoursByDay[dayId] ?? [];
    if (hasTimeLeft(ranges, cursor.year, cursor.month, cursor.day, now)) return true;
    cursor = addDaysInBusinessTz(cursor.year, cursor.month, cursor.day, 1);
  }
  return false;
}

export interface WeekWidgetStats {
  isThisWeek: boolean; // false once rolled forward to next week
  count: number;
}

/**
 * Esta semana widget: active bookings remaining from right now through the
 * end of the current Madrid-tz calendar week (Monday-Sunday). If the week's
 * business hours are all done (no open time left in any remaining day, Mon
 * through Sun), rolls forward to next week's full count instead.
 */
export async function getWeekWidgetStats(userId: string): Promise<WeekWidgetStats> {
  const business = await getBusinessForUser(userId);
  if (!business) return { isThisWeek: true, count: 0 };

  const now = new Date();
  const hoursByDay = await getBusinessHoursByDay(business.id);
  const { weekStartIso, weekEndIso } = getWeekBounds(now);

  if (weekHasTimeLeft(hoursByDay, weekStartIso, now)) {
    const count = await countActiveBookings(business.id, now, new Date(weekEndIso));
    return { isThisWeek: true, count };
  }

  const { weekStartIso: nextWeekStartIso, weekEndIso: nextWeekEndIso } = getWeekBounds(new Date(weekEndIso));
  const count = await countActiveBookings(business.id, new Date(nextWeekStartIso), new Date(nextWeekEndIso));
  return { isThisWeek: false, count };
}

/**
 * The calendar page's default landing week: this week if it still has any
 * open business hours left from right now, otherwise next week (e.g. Friday
 * evening after closing, with the weekend closed, lands on next week
 * instead of a dead current week). Same rollover rule as the Esta semana
 * widget, so clicking either widget or just opening Calendario directly all
 * land in the same place. Prev/next navigation is unaffected — earlier
 * weeks are always still reachable.
 */
export async function getDefaultCalendarWeekBounds(
  userId: string
): Promise<{ weekStartIso: string; weekEndIso: string }> {
  const business = await getBusinessForUser(userId);
  const now = new Date();
  const thisWeek = getWeekBounds(now);
  if (!business) return thisWeek;

  const hoursByDay = await getBusinessHoursByDay(business.id);
  if (weekHasTimeLeft(hoursByDay, thisWeek.weekStartIso, now)) return thisWeek;

  return getWeekBounds(new Date(thisWeek.weekEndIso));
}

const DAY_ORDER_MON_FIRST: DayId[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** [weekStartIso, weekEndIso) for the Madrid-tz week (Monday-Sunday) containing `date`. */
export function getWeekBounds(date: Date = new Date()): { weekStartIso: string; weekEndIso: string } {
  const dId = dayIdInTz(date, BUSINESS_TZ);
  const idx = DAY_ORDER_MON_FIRST.indexOf(dId);
  const { year, month, day } = tzDateParts(date, BUSINESS_TZ);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() - idx);
  const mp = tzDateParts(anchor, BUSINESS_TZ);
  const weekStart = zonedTimeToUtc(mp.year, mp.month, mp.day, 0, 0, BUSINESS_TZ);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  return { weekStartIso: weekStart.toISOString(), weekEndIso: weekEnd.toISOString() };
}
