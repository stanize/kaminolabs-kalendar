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

export interface ClientActiveBono {
  id: string;
  bonoTypeName: string;
  sessionsRemaining: number;
}

/**
 * A single client's bonos that still have sessions remaining — feeds the
 * payment-method dropdown in the booking-detail modal
 * (session-deduction-on-payment). Ordered oldest-purchased first, since the
 * oldest active bono is the DECIDED default selection in that dropdown; the
 * caller doesn't need to re-sort. Bonos with sessions_used >= sessions_total
 * are excluded entirely — a fully-used bono is never offered as a payment
 * option, matching the "bono option(s) simply don't appear" UI behavior.
 * Scoped by business AND client — never trust a client_id alone.
 */
export async function getActiveBonosForClient(
  userId: string,
  clientId: string
): Promise<ClientActiveBono[]> {
  const business = await getBusinessForUser(userId);
  if (!business || !clientId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_bono_purchases")
    .select("id, sessions_total, sessions_used, purchased_at, kalendar_bono_types ( name )")
    .eq("business_id", business.id)
    .eq("client_id", clientId)
    .order("purchased_at", { ascending: true });

  return ((data as {
    id: string;
    sessions_total: number;
    sessions_used: number;
    purchased_at: string;
    kalendar_bono_types: { name: string } | { name: string }[] | null;
  }[] | null) ?? [])
    .filter((r) => r.sessions_used < r.sessions_total)
    .map((r) => {
      const bonoType = Array.isArray(r.kalendar_bono_types) ? r.kalendar_bono_types[0] : r.kalendar_bono_types;
      return {
        id: r.id,
        bonoTypeName: bonoType?.name ?? "Bono",
        sessionsRemaining: r.sessions_total - r.sessions_used,
      };
    });
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

export interface ClientBonoSummary {
  id: string;
  bonoTypeName: string | null; // null if the bono type was later deleted
  sessionsTotal: number;
  sessionsUsed: number;
  pricePaid: number;
  purchasedAt: string;
}

/**
 * ALL of one client's bonos — active and fully-used alike — for the
 * client-detail page's "Bonos" summary (client-page-bono-summary,
 * bonos.md). Newest purchase first, since this is a history view rather
 * than the payment-modal's "which one to spend next" ordering used by
 * getActiveBonosForClient. Scoped by business AND client, same as
 * getActiveBonosForClient — never trust a client_id alone.
 */
export async function getBonosForClient(userId: string, clientId: string): Promise<ClientBonoSummary[]> {
  const business = await getBusinessForUser(userId);
  if (!business || !clientId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_bono_purchases")
    .select("id, sessions_total, sessions_used, price_paid, purchased_at, kalendar_bono_types ( name )")
    .eq("business_id", business.id)
    .eq("client_id", clientId)
    .order("purchased_at", { ascending: false });

  return ((data as {
    id: string;
    sessions_total: number;
    sessions_used: number;
    price_paid: number;
    purchased_at: string;
    kalendar_bono_types: { name: string } | { name: string }[] | null;
  }[] | null) ?? []).map((r) => {
    const bonoType = Array.isArray(r.kalendar_bono_types) ? r.kalendar_bono_types[0] : r.kalendar_bono_types;
    return {
      id: r.id,
      bonoTypeName: bonoType?.name ?? null,
      sessionsTotal: r.sessions_total,
      sessionsUsed: r.sessions_used,
      pricePaid: Number(r.price_paid),
      purchasedAt: r.purchased_at,
    };
  });
}

export interface BonoUsageSession {
  bookingId: string;
  serviceName: string;
  startsAt: string;
  status: "pending_confirmation" | "confirmed" | "cancelled" | "completed" | "no_show";
}

/**
 * The bookings currently consuming a specific bono's sessions — i.e. every
 * booking with bono_purchase_id = this bono and payment_method still
 * 'bono' (a reversed one clears both fields, so it naturally drops out of
 * this list on its own — no separate "already reversed" filter needed).
 * Most recent first. Feeds bono-session-reversal's usage-history view.
 */
export async function getBonoUsageHistory(userId: string, bonoPurchaseId: string): Promise<BonoUsageSession[]> {
  const business = await getBusinessForUser(userId);
  if (!business || !bonoPurchaseId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_bookings")
    .select("id, service_name, starts_at, status")
    .eq("business_id", business.id)
    .eq("bono_purchase_id", bonoPurchaseId)
    .eq("payment_method", "bono")
    .order("starts_at", { ascending: false });

  return ((data as { id: string; service_name: string; starts_at: string; status: BonoUsageSession["status"] }[] | null) ?? []).map(
    (r) => ({ bookingId: r.id, serviceName: r.service_name, startsAt: r.starts_at, status: r.status })
  );
}
