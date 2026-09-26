import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";

export interface BusinessClosure {
  id: string;
  business_id: string;
  team_member_id: string | null;
  recurring: boolean;
  month: number | null;
  day: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  label: string | null;
  created_at: string;
}

const CLOSURE_COLUMNS =
  "id, business_id, team_member_id, recurring, month, day, start_date, end_date, start_time, end_time, label, created_at";

/**
 * All closures (festivos + time off) for the given user's business, scoped by
 * userId (never a client-passed business_id) — mirrors getTeamForUser /
 * getBusinessHoursForUser. Callers split the flat list by `recurring` /
 * `team_member_id` for display (Festivos vs. per-provider time off).
 */
export async function getClosuresForUser(userId: string): Promise<BusinessClosure[]> {
  const business = await getBusinessForUser(userId);
  if (!business) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_business_closures")
    .select(CLOSURE_COLUMNS)
    .eq("business_id", business.id)
    .order("recurring", { ascending: false })
    .order("month", { ascending: true })
    .order("day", { ascending: true })
    .order("start_date", { ascending: true });

  return (data as BusinessClosure[] | null) ?? [];
}

/**
 * All closures for a given business id directly — used by the public
 * availability engine (`lib/actions/booking.ts`'s `getAvailableSlots`),
 * where there's no authenticated user to scope by; the business id itself
 * is already resolved from an active public slug before this is called
 * (same trust level as the other public queries in `getPublicBookingData`).
 */
export async function getClosuresForBusiness(businessId: string): Promise<BusinessClosure[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_business_closures")
    .select(CLOSURE_COLUMNS)
    .eq("business_id", businessId);

  return (data as BusinessClosure[] | null) ?? [];
}
