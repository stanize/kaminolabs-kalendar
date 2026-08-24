"use server";

import { revalidatePath } from "next/cache";
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

// ── Contact info (client-detail-view) ───────────────────────────────────────

export type UpdateClientResult = { ok: true } | { ok: false; error: string };

export interface ClientActionDict {
  errNoBusiness: string;
  errNotFound: string;
  errNameRequired: string;
  errSaveFailed: string;
}

const CLIENT_FALLBACK: ClientActionDict = {
  errNoBusiness: "No hay negocio.",
  errNotFound: "Cliente no encontrado.",
  errNameRequired: "Indica el nombre del cliente.",
  errSaveFailed: "No se pudo guardar el cambio.",
};

/**
 * Edits a client's own contact record (name/email/phone) — the clinic's
 * record, separate from any patient-portal profile the same person might
 * separately manage for themselves (see kalendar_clients.patient_id doc
 * comment — the soft link carries no write-through behavior either way).
 */
export const updateClientContactInfo = authedAction(
  async (
    session,
    input: { clientId: string; name: string; email: string; phone: string },
    dict?: Partial<ClientActionDict>
  ): Promise<UpdateClientResult> => {
    const t = { ...CLIENT_FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const name = input.name.trim();
    if (name.length < 1) return { ok: false, error: t.errNameRequired };

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("kalendar_clients")
      .select("id")
      .eq("id", input.clientId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!existing) return { ok: false, error: t.errNotFound };

    const { error } = await supabase
      .from("kalendar_clients")
      .update({
        name,
        email: input.email.trim() || null,
        phone: input.phone.trim() || null,
      })
      .eq("id", input.clientId)
      .eq("business_id", business.id);

    if (error) return { ok: false, error: t.errSaveFailed };

    revalidatePath(`/panel/clients/${input.clientId}`);
    return { ok: true };
  }
);

// ── Private notes (private-clinic-notes) ────────────────────────────────────

export type ClientNoteResult =
  | { ok: true; noteId: string }
  | { ok: false; error: string };

/**
 * STRICTLY PRIVATE — see the schema comment on kalendar_client_notes.
 * These three actions are the only write path for notes; nothing in the
 * patient portal or any patient-authenticated route touches this table.
 */
export const addClientNote = authedAction(
  async (
    session,
    input: { clientId: string; body: string },
    dict?: Partial<ClientActionDict>
  ): Promise<ClientNoteResult> => {
    const t = { ...CLIENT_FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const body = input.body.trim();
    if (!body) return { ok: false, error: t.errSaveFailed };

    const supabase = await createClient();
    // Confirm the client actually belongs to this business before writing
    // a note against it — clientId comes from the client, never trusted.
    const { data: ownedClient } = await supabase
      .from("kalendar_clients")
      .select("id")
      .eq("id", input.clientId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!ownedClient) return { ok: false, error: t.errNotFound };

    const { data: created, error } = await supabase
      .from("kalendar_client_notes")
      .insert({
        client_id: input.clientId,
        business_id: business.id,
        author_id: session.user.id,
        body,
      })
      .select("id")
      .single();

    if (error || !created) return { ok: false, error: t.errSaveFailed };

    revalidatePath(`/panel/clients/${input.clientId}`);
    return { ok: true, noteId: created.id };
  }
);

export const updateClientNote = authedAction(
  async (
    session,
    input: { noteId: string; clientId: string; body: string },
    dict?: Partial<ClientActionDict>
  ): Promise<UpdateClientResult> => {
    const t = { ...CLIENT_FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const body = input.body.trim();
    if (!body) return { ok: false, error: t.errSaveFailed };

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("kalendar_client_notes")
      .select("id")
      .eq("id", input.noteId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!existing) return { ok: false, error: t.errNotFound };

    const { error } = await supabase
      .from("kalendar_client_notes")
      .update({ body, updated_at: new Date().toISOString() })
      .eq("id", input.noteId)
      .eq("business_id", business.id);

    if (error) return { ok: false, error: t.errSaveFailed };

    revalidatePath(`/panel/clients/${input.clientId}`);
    return { ok: true };
  }
);

export const deleteClientNote = authedAction(
  async (
    session,
    input: { noteId: string; clientId: string },
    dict?: Partial<ClientActionDict>
  ): Promise<UpdateClientResult> => {
    const t = { ...CLIENT_FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("kalendar_client_notes")
      .select("id")
      .eq("id", input.noteId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!existing) return { ok: false, error: t.errNotFound };

    const { error } = await supabase
      .from("kalendar_client_notes")
      .delete()
      .eq("id", input.noteId)
      .eq("business_id", business.id);

    if (error) return { ok: false, error: t.errSaveFailed };

    revalidatePath(`/panel/clients/${input.clientId}`);
    return { ok: true };
  }
);
