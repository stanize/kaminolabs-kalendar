import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the kalendar_clients.id a new booking should link to
 * (kalendar_bookings.clinic_client_id) — clinic-clients-page.md's
 * client-linking-on-booking step. Two distinct behaviors depending on who's
 * booking:
 *
 * - Authenticated patient (patientId set): find-or-create by
 *   (business_id, patient_id) — patient_id is a stable identity, so their
 *   bookings at this clinic accumulate onto ONE kalendar_clients row over
 *   time (this is what makes the denormalized counters — total_sessions
 *   etc. — meaningful; it also matches how the client-status badge
 *   feature already determines first-time/returning off patient_id
 *   history, so both features agree on what "the same client" means).
 *
 * - Guest (patientId null): ALWAYS creates a new row, no lookup/dedupe by
 *   email or phone — this is a explicit, already-decided schema design
 *   choice (see the comment on kalendar_clients in schema_001.sql), not an
 *   oversight. A guest has no stable identity Kalendar can trust (anyone
 *   can type any email), so guessing "this is the same person as last
 *   time" risks silently merging two different people's history.
 *
 * - EXCEPTION — WhatsApp guest bookings (matchByPhone: true), 2026-09-22:
 *   a WhatsApp sender's phone number is NOT self-reported the way a typed
 *   email is — it's literally who sent the inbound message, so unlike a
 *   guest-typed email it's a trustworthy identity signal. For this case
 *   only (set exclusively from lib/whatsapp/conversation.ts's
 *   awaitingConfirmation, via submitBookingInternal), look up an existing
 *   kalendar_clients row for (business_id, phone) with patient_id IS NULL
 *   (a prior guest/WhatsApp record — never someone else's linked portal
 *   account) and reuse its id if found, instead of always creating a new
 *   row.
 *
 *   PLACEHOLDER-NAME UPGRADE (2026-09-22, profile-name capture): now that a
 *   real WhatsApp display name (Twilio's ProfileName) may be available,
 *   the reused row's `name` is refreshed, but only in the narrow,
 *   never-downgrading direction — the existing row's stored name currently
 *   IS still the synthetic `WhatsApp <phone>` placeholder shape AND the
 *   new booking's `name` is a real (non-placeholder-shaped) value, e.g.
 *   their first WhatsApp message didn't carry a ProfileName but a later one
 *   did. A row that already has a real name is never overwritten — a later
 *   booking's name is never trusted over an already-known real one (no
 *   "latest wins" churn), and a genuine placeholder is never written over a
 *   real name. This keeps the rule simple: upgrade placeholder -> real,
 *   never real -> anything, never placeholder -> placeholder.
 */
const WHATSAPP_PLACEHOLDER_NAME_RE = /^WhatsApp\s.+$/;
export async function resolveClinicClientId(input: {
  businessId: string;
  patientId: string | null;
  name: string;
  email: string;
  phone: string | null;
  /** WhatsApp-guest-only: match/reuse an existing guest kalendar_clients row
   * by (business_id, phone) instead of always creating a new one. Never set
   * for website bookings — see doc comment above. */
  matchByPhone?: boolean;
}): Promise<string | null> {
  const supabase = await createClient();

  if (input.patientId) {
    const { data: existing } = await supabase
      .from("kalendar_clients")
      .select("id")
      .eq("business_id", input.businessId)
      .eq("patient_id", input.patientId)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .from("kalendar_clients")
      .insert({
        business_id: input.businessId,
        patient_id: input.patientId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
      })
      .select("id")
      .single();

    if (error || !created) return null;
    return created.id;
  }

  // Guest — WhatsApp-specific phone-match exception (see doc comment above).
  if (input.matchByPhone && input.phone) {
    const { data: existingGuest } = await supabase
      .from("kalendar_clients")
      .select("id, name")
      .eq("business_id", input.businessId)
      .is("patient_id", null)
      .eq("phone", input.phone)
      .maybeSingle();

    if (existingGuest) {
      // Placeholder -> real name upgrade only (see doc comment above) — a
      // real name already on the row is never touched.
      const existingIsPlaceholder = WHATSAPP_PLACEHOLDER_NAME_RE.test(existingGuest.name ?? "");
      const newNameIsReal = !!input.name && !WHATSAPP_PLACEHOLDER_NAME_RE.test(input.name);
      if (existingIsPlaceholder && newNameIsReal) {
        await supabase.from("kalendar_clients").update({ name: input.name }).eq("id", existingGuest.id);
      }
      return existingGuest.id;
    }
  }

  // Guest — otherwise always a new row, no dedupe (see doc comment above).
  const { data: created, error } = await supabase
    .from("kalendar_clients")
    .insert({
      business_id: input.businessId,
      patient_id: null,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id;
}
