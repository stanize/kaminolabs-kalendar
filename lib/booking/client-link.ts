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
 */
export async function resolveClinicClientId(input: {
  businessId: string;
  patientId: string | null;
  name: string;
  email: string;
  phone: string | null;
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

  // Guest — always a new row, no dedupe (see doc comment above).
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
