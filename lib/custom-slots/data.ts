import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import type { DayId } from "@/lib/onboarding/types";
import type { SlotType, FrequencyRange } from "@/lib/custom-slots/frequency";

export interface CustomTimeSlotRule {
  id: string;
  businessId: string;
  label: string | null;
  days: DayId[]; // empty = every open day
  teamMemberIds: string[]; // empty = all providers
  // For a "custom" rule: the clinic-entered list. For a "frequency" rule:
  // generated from frequencyRanges on every save, so every
  // consumer (booking form suggestions, future public page) reads `times`
  // the same way regardless of type.
  times: string[]; // "HH:MM"
  slotType: SlotType;
  frequencyRanges: FrequencyRange[]; // frequency rules only; empty for custom
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
    // "*" rather than a column list: tolerates the slot_type/range/frequency
    // columns (schema_subset_042.sql) not existing yet during the window
    // between deploy and the live migration — they just read as undefined
    // and fall back to the "custom" defaults below.
    .select("*")
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
    slot_type?: string | null;
    frequency_ranges?: FrequencyRange[] | null;
    sort_order: number;
    created_at: string;
  }[] | null) ?? []).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    label: r.label,
    days: (r.days ?? []) as DayId[],
    teamMemberIds: r.team_member_ids ?? [],
    times: r.times ?? [],
    slotType: r.slot_type === "frequency" ? "frequency" : "custom",
    frequencyRanges: Array.isArray(r.frequency_ranges) ? r.frequency_ranges : [],
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }));
}
