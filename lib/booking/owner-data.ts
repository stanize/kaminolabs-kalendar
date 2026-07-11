import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import { getTeamForUser } from "@/lib/team/data";
import { getServicesForUser } from "@/lib/services/data";
import { generateSlotsForDay, dayIdInTz, tzDateParts, zonedTimeToUtc, BUSINESS_TZ } from "@/lib/booking/slots";
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

// ── Today widget: appointment count + free-slot estimate ───────────────────

export interface TodayStats {
  totalToday: number;
  freeSlotsToday: number;
}

/** Generic slot granularity used only for the "free slots today" estimate —
 * unlike the real booking engine, this widget isn't tied to a specific
 * service duration, so it approximates with a fixed 30-minute grid. */
const WIDGET_SLOT_MINUTES = 30;

/**
 * Today's appointment count (pending + confirmed) and an estimated count of
 * remaining free slots today, summed across all providers. Free slots use a
 * fixed 30-minute grid (see WIDGET_SLOT_MINUTES) since "a slot" has no fixed
 * duration outside of a specific service — this is a dashboard estimate, not
 * the exact booking-engine availability.
 */
export async function getTodayStats(userId: string): Promise<TodayStats> {
  const business = await getBusinessForUser(userId);
  if (!business) return { totalToday: 0, freeSlotsToday: 0 };

  const now = new Date();
  const { year, month, day } = tzDateParts(now, BUSINESS_TZ);
  const dayId = dayIdInTz(now, BUSINESS_TZ);

  const supabase = await createClient();
  const [hoursByDay, members, bookingsRes] = await Promise.all([
    getBusinessHoursByDay(business.id),
    getTeamForUser(userId),
    supabase
      .from("kalendar_bookings")
      .select("starts_at, ends_at, team_member_id, status")
      .eq("business_id", business.id)
      .in("status", ["pending_confirmation", "confirmed"])
      .gte(
        "starts_at",
        new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString()
      )
      .lt(
        "starts_at",
        new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0)).toISOString()
      ),
  ]);

  const todaysBookings =
    (bookingsRes.data as
      | { starts_at: string; ends_at: string; team_member_id: string | null }[]
      | null) ?? [];

  const ranges = hoursByDay[dayId] ?? [];
  if (ranges.length === 0 || members.length === 0) {
    return { totalToday: todaysBookings.length, freeSlotsToday: 0 };
  }

  let freeSlotsToday = 0;
  for (const member of members) {
    const taken = todaysBookings
      .filter((b) => b.team_member_id === member.id)
      .map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) }));
    const slots = generateSlotsForDay({
      dateInTz: { year, month, day },
      ranges,
      durationMin: WIDGET_SLOT_MINUTES,
      taken,
      now,
    });
    freeSlotsToday += slots.length;
  }

  return { totalToday: todaysBookings.length, freeSlotsToday };
}

// ── Week bounds helper (server-side, mirrors the client's mondayStart) ─────

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
