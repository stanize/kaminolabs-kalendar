import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";

export interface BonoType {
  id: string;
  name: string;
  sessionCount: number;
  price: number;
  active: boolean;
}

/** All bono types for the caller's business, active first, then by name. */
export async function getBonoTypesForBusiness(userId: string): Promise<BonoType[]> {
  const business = await getBusinessForUser(userId);
  if (!business) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_bono_types")
    .select("id, name, session_count, price, active")
    .eq("business_id", business.id)
    .order("active", { ascending: false })
    .order("name", { ascending: true });

  return ((data as {
    id: string; name: string; session_count: number; price: number; active: boolean;
  }[] | null) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    sessionCount: r.session_count,
    price: Number(r.price),
    active: r.active,
  }));
}

/** Only active bono types — used by the "Vender bono" picker (can't sell a retired type). */
export async function getActiveBonoTypesForBusiness(userId: string): Promise<BonoType[]> {
  return (await getBonoTypesForBusiness(userId)).filter((t) => t.active);
}

export interface SoldBono {
  id: string;
  clientId: string;
  clientName: string;
  bonoTypeName: string | null; // null if the bono type was later deleted (on delete set null)
  sessionsTotal: number;
  sessionsUsed: number;
  pricePaid: number;
  purchasedAt: string;
}

/**
 * All sold bonos for the caller's business, most recently purchased first —
 * "Bonos vendidos" tab. Joins in the client and bono-type NAMES for display
 * only; sessionsTotal/pricePaid are the purchase's own snapshot values, not
 * read from the (possibly since-changed or deleted) bono type.
 */
export async function getSoldBonosForBusiness(userId: string): Promise<SoldBono[]> {
  const business = await getBusinessForUser(userId);
  if (!business) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_bono_purchases")
    .select(`
      id,
      client_id,
      sessions_total,
      sessions_used,
      price_paid,
      purchased_at,
      kalendar_clients ( name ),
      kalendar_bono_types ( name )
    `)
    .eq("business_id", business.id)
    .order("purchased_at", { ascending: false });

  return ((data as {
    id: string;
    client_id: string;
    sessions_total: number;
    sessions_used: number;
    price_paid: number;
    purchased_at: string;
    kalendar_clients: { name: string } | { name: string }[] | null;
    kalendar_bono_types: { name: string } | { name: string }[] | null;
  }[] | null) ?? []).map((r) => {
    const client = Array.isArray(r.kalendar_clients) ? r.kalendar_clients[0] : r.kalendar_clients;
    const bonoType = Array.isArray(r.kalendar_bono_types) ? r.kalendar_bono_types[0] : r.kalendar_bono_types;
    return {
      id: r.id,
      clientId: r.client_id,
      clientName: client?.name ?? "",
      bonoTypeName: bonoType?.name ?? null,
      sessionsTotal: r.sessions_total,
      sessionsUsed: r.sessions_used,
      pricePaid: Number(r.price_paid),
      purchasedAt: r.purchased_at,
    };
  });
}
