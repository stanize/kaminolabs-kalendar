import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";

export interface Service {
  id: string;
  business_id: string;
  name: string;
  duration_min: number;
  price: number;
  sort_order: number;
  created_at: string;
}

const SERVICE_COLUMNS = "id, business_id, name, duration_min, price, sort_order, created_at";

/**
 * All services for the given user's business, ordered for display. Scoped by
 * userId: the business is resolved from owner_id (never a client-passed
 * business_id). Returns [] when the user has no business yet.
 */
export async function getServicesForUser(userId: string): Promise<Service[]> {
  const business = await getBusinessForUser(userId);
  if (!business) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_services")
    .select(SERVICE_COLUMNS)
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (data as Service[] | null) ?? [];
}
