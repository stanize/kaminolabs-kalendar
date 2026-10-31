import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import type { DayId } from "@/lib/onboarding/types";

export interface CustomTimeSlotRule {
  id: string;
  businessId: string;
  label: string | null;
  days: DayId[]; // empty = every open day
  teamMemberIds: string[]; // empty = all providers
  times: string[]; // "HH:MM", clinic-entered order
  sortOrder: number;
  createdAt: string;
}

/**
 * custom-time-slots (workflows/custom-time-slots.md) — every rule for the
 * caller's own business, scoped by userId (never a client-passed
 * business_id), same convention as getClosuresForUser/
 * getBusinessHoursForUser. Additive/opt-in on top of kalendar_business_hours
 * — an empty list here means every provider/day falls back to the existing
 * generic hourly suggestions, unchanged.
 */
export async function getCustomTimeSlotsForUser(userId: string): Promise<CustomTimeSlotRule[]> {
  const business = await getBusinessForUser(userId);
  if (!business) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_custom_time_slots")
    .select("id, business_id, label, days, team_member_ids, times, sort_order, created_at")
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return ((data as {
    id: string;
    business_id: string;
    label: string | null;
    days: string[] | null;
    team_member_ids: string[] | null;
    times: string[] | null;
    sort_order: number;
    created_at: string;
  }[] | null) ?? []).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    label: r.label,
    days: (r.days ?? []) as DayId[],
    teamMemberIds: r.team_member_ids ?? [],
    times: r.times ?? [],
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }));
}
