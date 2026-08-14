import { createClient } from "@/lib/supabase/server";

/**
 * The client-relationship status a clinic sees on every booking, distinct
 * from the booking's own confirmation status (pending_confirmation/
 * confirmed/etc.) — this is about how much the clinic should double-check
 * the reservation, not whether the slot is held (it's held either way).
 *
 * - guest_unconfirmed: no patient account, hasn't clicked their email
 *   confirm link yet (booking.status === 'pending_confirmation'). Needs
 *   the most scrutiny — highest no-show/spam risk.
 * - guest_confirmed: no patient account, but did confirm via the email
 *   link (booking.status !== 'pending_confirmation'). Some scrutiny.
 * - first_time: has a patient account, but no prior non-cancelled booking
 *   at THIS clinic. Some scrutiny — registered, but unknown to this clinic.
 * - returning: has a patient account AND at least one prior non-cancelled
 *   booking at this clinic. No scrutiny needed — established relationship.
 *
 * Authenticated-patient bookings always start as status='confirmed'
 * immediately (see schema comment on kalendar_bookings) — pending_
 * confirmation only ever happens for guest bookings — so patient_id being
 * set is sufficient to rule out the two guest_* cases entirely.
 */
export type ClientStatus = "guest_unconfirmed" | "guest_confirmed" | "first_time" | "returning";

/**
 * Attaches clientStatus to a set of bookings for one business, in a single
 * batched query rather than one query per booking. "First-time" per Arun's
 * definition: the patient has NO prior booking at this clinic with
 * starts_at in the past AND status != 'cancelled' — a cancelled past
 * booking doesn't count as an established relationship. Deliberately
 * computed live from kalendar_bookings rather than kalendar_clients'
 * denormalized total_sessions/first_visit_at counters, since those only
 * update when an owner manually saves a Resultado (see updateBookingResult)
 * and would under-count for a clinic that doesn't bother doing that for
 * every past booking.
 */
export async function attachClientStatus<
  T extends { id: string; patient_id: string | null; status: string }
>(businessId: string, rows: T[]): Promise<(T & { clientStatus: ClientStatus })[]> {
  const patientIds = [...new Set(rows.map((r) => r.patient_id).filter((id): id is string => !!id))];

  let returningPatientIds = new Set<string>();
  if (patientIds.length > 0) {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("kalendar_bookings")
      .select("patient_id")
      .eq("business_id", businessId)
      .in("patient_id", patientIds)
      .lt("starts_at", nowIso)
      .neq("status", "cancelled");

    returningPatientIds = new Set(
      ((data as { patient_id: string | null }[] | null) ?? [])
        .map((r) => r.patient_id)
        .filter((id): id is string => !!id)
    );
  }

  return rows.map((r) => {
    let clientStatus: ClientStatus;
    if (!r.patient_id) {
      clientStatus = r.status === "pending_confirmation" ? "guest_unconfirmed" : "guest_confirmed";
    } else {
      clientStatus = returningPatientIds.has(r.patient_id) ? "returning" : "first_time";
    }
    return { ...r, clientStatus };
  });
}
