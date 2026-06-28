import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import type { DayId } from "@/lib/onboarding/types";
import type { TimeRange } from "@/lib/availability/constants";

export interface HoursRow {
  id: string;
  business_id: string;
  day: DayId;
  start_time: string; // "HH:MM:SS" from Postgres time
  end_time: string;
  sort_order: number;
}

/** "HH:MM:SS" (or "HH:MM") -> "HH:MM". */
function hhmm(t: string): string {
  return t.slice(0, 5);
}

/**
 * The business's working hours grouped by weekday, each value an ordered list of
 * {start,end} ranges in "HH:MM". Days with no intervals are absent (closed).
 * Scoped by userId via the owning business. Returns {} when no business.
 */
export async function getBusinessHoursForUser(
  userId: string
): Promise<Partial<Record<DayId, TimeRange[]>>> {
  const business = await getBusinessForUser(userId);
  if (!business) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_business_hours")
    .select("id, business_id, day, start_time, end_time, sort_order")
    .eq("business_id", business.id)
    .order("day", { ascending: true })
    .order("sort_order", { ascending: true });

  const rows = (data as HoursRow[] | null) ?? [];
  const grouped: Partial<Record<DayId, TimeRange[]>> = {};
  for (const r of rows) {
    (grouped[r.day] ??= []).push({ start: hhmm(r.start_time), end: hhmm(r.end_time) });
  }
  return grouped;
}
