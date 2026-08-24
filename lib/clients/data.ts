import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import type { BookingStatus } from "@/lib/booking/owner-data";

export interface ClientListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalSessions: number;
  lastVisitAt: string | null;
}

/**
 * All kalendar_clients rows for the caller's business — clients-list-page.
 * Ordered by most recently seen first (nulls-last), which is the most
 * useful default for a clinic scanning "who have we dealt with."
 */
export async function getClientsForBusiness(userId: string): Promise<ClientListItem[]> {
  const business = await getBusinessForUser(userId);
  if (!business) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_clients")
    .select("id, name, email, phone, total_sessions, last_visit_at")
    .eq("business_id", business.id)
    .order("last_visit_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return ((data as {
    id: string; name: string; email: string | null; phone: string | null;
    total_sessions: number; last_visit_at: string | null;
  }[] | null) ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    totalSessions: c.total_sessions,
    lastVisitAt: c.last_visit_at,
  }));
}

export interface ClientBookingSummary {
  id: string;
  serviceName: string;
  startIso: string;
  durationMin: number;
  status: BookingStatus;
  providerName: string | null;
}

export interface ClientDetail {
  id: string;
  businessId: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalSessions: number;
  completedCount: number;
  noShowCount: number;
  cancelledCount: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  upcoming: ClientBookingSummary[];
  history: ClientBookingSummary[];
}

/**
 * client-360 detail — client-detail-view. Scoped to the caller's own
 * business (never trusts clientId alone). Splits bookings into upcoming
 * (future, not yet happened) and history (past OR already resolved),
 * matching calendar-management-past.md's completed/no_show/cancelled
 * status set for the history side.
 */
export async function getClientDetail(userId: string, clientId: string): Promise<ClientDetail | null> {
  const business = await getBusinessForUser(userId);
  if (!business) return null;

  const supabase = await createClient();

  const { data: client } = await supabase
    .from("kalendar_clients")
    .select("id, business_id, name, email, phone, total_sessions, completed_count, no_show_count, cancelled_count, first_visit_at, last_visit_at")
    .eq("id", clientId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!client) return null;

  const nowIso = new Date().toISOString();

  const [{ data: upcomingRows }, { data: historyRows }] = await Promise.all([
    supabase
      .from("kalendar_bookings")
      .select("id, service_name, starts_at, service_duration_min, status, team_member_id")
      .eq("clinic_client_id", clientId)
      .eq("business_id", business.id)
      .gte("starts_at", nowIso)
      .in("status", ["pending_confirmation", "confirmed"])
      .order("starts_at", { ascending: true }),
    supabase
      .from("kalendar_bookings")
      .select("id, service_name, starts_at, service_duration_min, status, team_member_id")
      .eq("clinic_client_id", clientId)
      .eq("business_id", business.id)
      .or(`starts_at.lt.${nowIso},status.in.(completed,no_show,cancelled)`)
      .order("starts_at", { ascending: false })
      .limit(100),
  ]);

  const memberIds = new Set(
    [...(upcomingRows ?? []), ...(historyRows ?? [])]
      .map((b) => b.team_member_id)
      .filter((id): id is string => !!id)
  );
  const memberName = new Map<string, string>();
  if (memberIds.size > 0) {
    const { data: members } = await supabase
      .from("kalendar_team_members")
      .select("id, name")
      .in("id", [...memberIds]);
    for (const m of (members as { id: string; name: string }[] | null) ?? []) {
      memberName.set(m.id, m.name);
    }
  }

  const toSummary = (b: {
    id: string; service_name: string; starts_at: string; service_duration_min: number;
    status: BookingStatus; team_member_id: string | null;
  }): ClientBookingSummary => ({
    id: b.id,
    serviceName: b.service_name,
    startIso: b.starts_at,
    durationMin: b.service_duration_min,
    status: b.status,
    providerName: b.team_member_id ? memberName.get(b.team_member_id) ?? null : null,
  });

  return {
    id: client.id,
    businessId: client.business_id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    totalSessions: client.total_sessions,
    completedCount: client.completed_count,
    noShowCount: client.no_show_count,
    cancelledCount: client.cancelled_count,
    firstVisitAt: client.first_visit_at,
    lastVisitAt: client.last_visit_at,
    upcoming: (upcomingRows ?? []).map(toSummary),
    history: (historyRows ?? []).map(toSummary),
  };
}

export interface ClientNote {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** private-clinic-notes — most-recent-first, scoped via the client's own business. */
export async function getClientNotes(userId: string, clientId: string): Promise<ClientNote[]> {
  const business = await getBusinessForUser(userId);
  if (!business) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("kalendar_client_notes")
    .select("id, body, created_at, updated_at, author_id")
    .eq("client_id", clientId)
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const rows = (data as {
    id: string; body: string; created_at: string; updated_at: string; author_id: string | null;
  }[] | null) ?? [];

  const authorIds = [...new Set(rows.map((r) => r.author_id).filter((id): id is string => !!id))];
  const authorName = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: users } = await supabase
      .from("user")
      .select("id, name")
      .in("id", authorIds);
    for (const u of (users as { id: string; name: string }[] | null) ?? []) {
      authorName.set(u.id, u.name);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    authorName: r.author_id ? authorName.get(r.author_id) ?? null : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
