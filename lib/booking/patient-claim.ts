import { createClient } from "@/lib/supabase/server";

/**
 * Escapes ilike's wildcard characters (%, _, \) so an "exact, case-
 * insensitive" match doesn't accidentally become a pattern match — '_' in
 * particular is a LEGAL character in an email local-part (e.g.
 * "john_doe@example.com"), so without this, ilike would treat it as
 * "any single character" and wrongly match "john.doe@example.com" too.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Finds an existing patient account by email — used to recognize someone
 * clinic staff is manually booking (createBookingAsOwner,
 * lib/actions/booking-owner.ts) as an already-registered patient, instead
 * of always creating a guest-shaped booking for them.
 *
 * Only ever matches a VERIFIED account. This is the same trust boundary as
 * claimExistingClientHistory below: linking by an email nobody has proven
 * they control would let a typo, or a maliciously-entered email, attach a
 * booking to a stranger's real account.
 *
 * Case-insensitive (see user_email_lower_idx, schema_001.sql).
 */
export async function findVerifiedPatientIdByEmail(email: string): Promise<string | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("user")
    .select("id, emailVerified")
    .ilike("email", escapeLikePattern(trimmed))
    .maybeSingle();

  if (!user || user.emailVerified !== true) return null;

  const { data: patient } = await supabase
    .from("kalendar_patients")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return patient?.id ?? null;
}

/**
 * Links every currently-unlinked kalendar_clients row (across EVERY
 * business on the platform — kalendar_clients has no cross-business
 * dedupe by design, and kalendar_patients is a single global identity, so
 * a person could have guest/walk-in history at more than one clinic under
 * the same email) matching this email to the given patient, AND backfills
 * patient_id directly onto every one of that client's own past bookings.
 *
 * The booking backfill matters: kalendar_bookings.patient_id (not
 * clinic_client_id) is what the patient portal's "my bookings" query and
 * client-status.ts's returning-client detection both key off. Without
 * backfilling it, linking kalendar_clients alone would make FUTURE
 * bookings at that client_id correctly recognized, but past ones would
 * stay invisible to the patient's own portal and still misclassify as
 * guest_confirmed forever — silently only fixing half the picture.
 *
 * Called from two directions (2026-09, "unify guests and patients" —
 * neither should lose history once linked):
 *   • claimGuestHistoryIfEligible (lib/actions/patient.ts) — once a
 *     newly-registered account's email verifies.
 *   • createBookingAsOwner (lib/actions/booking-owner.ts) — when staff
 *     types in an email matching an existing verified patient, to also
 *     sweep up any of their OTHER pre-existing history, not just link the
 *     one new booking being created right now.
 *
 * Best-effort: never throws, returns zero counts on any failure — a
 * linking failure should never block whatever the caller was actually
 * doing (registering, or creating a booking).
 */
export async function claimExistingClientHistory(
  patientId: string,
  email: string
): Promise<{ clientsLinked: number; bookingsLinked: number }> {
  const trimmed = email.trim();
  if (!trimmed) return { clientsLinked: 0, bookingsLinked: 0 };

  try {
    const supabase = await createClient();

    const { data: matchedClients } = await supabase
      .from("kalendar_clients")
      .select("id")
      .is("patient_id", null)
      .ilike("email", escapeLikePattern(trimmed));

    const clientIds = (matchedClients ?? []).map((c) => c.id);
    if (clientIds.length === 0) return { clientsLinked: 0, bookingsLinked: 0 };

    const { error: clientsError, count: clientsLinked } = await supabase
      .from("kalendar_clients")
      .update({ patient_id: patientId }, { count: "exact" })
      .in("id", clientIds)
      .is("patient_id", null); // re-check null: guards a race against a concurrent claim of the same email

    if (clientsError) return { clientsLinked: 0, bookingsLinked: 0 };

    const { count: bookingsLinked } = await supabase
      .from("kalendar_bookings")
      .update({ patient_id: patientId }, { count: "exact" })
      .in("clinic_client_id", clientIds)
      .is("patient_id", null);

    return { clientsLinked: clientsLinked ?? 0, bookingsLinked: bookingsLinked ?? 0 };
  } catch {
    return { clientsLinked: 0, bookingsLinked: 0 };
  }
}
