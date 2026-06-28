import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessBySlug, type Business } from "@/lib/business/data";
import type { DayId } from "@/lib/onboarding/types";
import type { TimeRange, TakenInterval } from "@/lib/booking/slots";

export interface PublicService {
  id: string;
  name: string;
  duration_min: number;
  price: number;
}

export interface PublicMember {
  id: string;
  name: string;
  role: string | null;
}

export interface PublicBookingData {
  business: Business;
  services: PublicService[];
  hoursByDay: Partial<Record<DayId, TimeRange[]>>;
  members: PublicMember[]; // empty for solo; populated for team
}

function hhmm(t: string): string {
  return t.slice(0, 5);
}

/**
 * Everything the public booking page needs for an active business, or null if
 * the slug isn't active. Read-only and unauthenticated (this is the public page).
 */
export async function getPublicBookingData(slug: string): Promise<PublicBookingData | null> {
  const business = await getActiveBusinessBySlug(slug);
  if (!business) return null;

  const supabase = await createClient();

  const [servicesRes, hoursRes, membersRes] = await Promise.all([
    supabase
      .from("kalendar_services")
      .select("id, name, duration_min, price")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("kalendar_business_hours")
      .select("day, start_time, end_time, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("kalendar_team_members")
      .select("id, name, role, is_owner, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true }),
  ]);

  const hoursByDay: Partial<Record<DayId, TimeRange[]>> = {};
  for (const r of (hoursRes.data as { day: DayId; start_time: string; end_time: string }[] | null) ?? []) {
    (hoursByDay[r.day] ??= []).push({ start: hhmm(r.start_time), end: hhmm(r.end_time) });
  }

  // Team members only matter for provider selection in team mode.
  const members: PublicMember[] =
    business.team_mode === "team"
      ? ((membersRes.data as PublicMember[] | null) ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
        }))
      : [];

  return {
    business,
    services: (servicesRes.data as PublicService[] | null) ?? [],
    hoursByDay,
    members,
  };
}

/**
 * Active (pending/confirmed) bookings as taken intervals within [from, to),
 * optionally scoped to a specific provider. For solo or "cualquiera" with a
 * pinned member id, pass that id; pass null to consider all of the business's
 * bookings (solo).
 */
export async function getTakenIntervals(params: {
  businessId: string;
  from: Date;
  to: Date;
  teamMemberId?: string | null;
}): Promise<TakenInterval[]> {
  const { businessId, from, to, teamMemberId } = params;
  const supabase = await createClient();

  let query = supabase
    .from("kalendar_bookings")
    .select("starts_at, ends_at, team_member_id, status")
    .eq("business_id", businessId)
    .in("status", ["pending_confirmation", "confirmed"])
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString());

  if (teamMemberId) {
    query = query.eq("team_member_id", teamMemberId);
  }

  const { data } = await query;
  return ((data as { starts_at: string; ends_at: string }[] | null) ?? []).map((b) => ({
    start: new Date(b.starts_at),
    end: new Date(b.ends_at),
  }));
}
