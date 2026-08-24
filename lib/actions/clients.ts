"use server";

import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";

export interface ClientSearchResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalSessions: number;
  lastVisitAt: string | null;
}

/**
 * Searches the caller's own kalendar_clients rows by name/email/phone —
 * powers the manual-booking client picker (client-linking-on-booking,
 * clinic-clients-page.md) so an owner creating a booking can find and reuse
 * an existing client instead of always creating a new row. Empty/short
 * query returns nothing rather than the whole list, to keep this cheap as
 * a type-ahead — the future clients-list-page (not yet built) is the right
 * place for browsing/paginating the full list.
 */
export const searchClients = authedAction(
  async (session, query: string): Promise<ClientSearchResult[]> => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const business = await getBusinessForUser(session.user.id);
    if (!business) return [];

    const supabase = await createClient();
    const like = `%${trimmed}%`;

    const { data } = await supabase
      .from("kalendar_clients")
      .select("id, name, email, phone, total_sessions, last_visit_at")
      .eq("business_id", business.id)
      .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .order("last_visit_at", { ascending: false, nullsFirst: false })
      .limit(8);

    return ((data as {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      total_sessions: number;
      last_visit_at: string | null;
    }[] | null) ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      totalSessions: c.total_sessions,
      lastVisitAt: c.last_visit_at,
    }));
  }
);
