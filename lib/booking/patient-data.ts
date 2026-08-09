import { createClient } from "@/lib/supabase/server";

export interface PatientBooking {
  id: string;
  businessName: string;
  businessSlug: string;
  serviceName: string;
  servicePrice: number;
  durationMin: number;
  startsAt: string;
  endsAt: string;
  status: "pending_confirmation" | "confirmed" | "cancelled" | "completed";
  providerName: string | null;
}

/**
 * Fetches all bookings for a given patient (by patient_id), sorted by
 * starts_at descending (most recent first). Used by the patient portal.
 */
export async function getPatientBookings(patientId: string): Promise<PatientBooking[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("kalendar_bookings")
    .select(`
      id,
      service_name,
      service_price,
      service_duration_min,
      starts_at,
      ends_at,
      status,
      team_member_id,
      kalendar_businesses!inner (
        name,
        slug
      ),
      kalendar_team_members (
        name
      )
    `)
    .eq("patient_id", patientId)
    .order("starts_at", { ascending: false });

  if (!data) return [];

  return data.map((b) => {
    const biz = Array.isArray(b.kalendar_businesses)
      ? b.kalendar_businesses[0]
      : b.kalendar_businesses;
    const member = Array.isArray(b.kalendar_team_members)
      ? b.kalendar_team_members[0]
      : b.kalendar_team_members;

    return {
      id: b.id,
      businessName: biz?.name ?? "",
      businessSlug: biz?.slug ?? "",
      serviceName: b.service_name,
      servicePrice: Number(b.service_price),
      durationMin: b.service_duration_min,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      status: b.status,
      providerName: member?.name ?? null,
    };
  });
}
