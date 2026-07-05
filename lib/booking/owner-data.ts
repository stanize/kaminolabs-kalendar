import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";

export type BookingStatus = "pending_confirmation" | "confirmed" | "cancelled" | "completed";

export interface OwnerBooking {
  id: string;
  service_name: string;
  service_duration_min: number;
  service_price: number;
  team_member_id: string | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  pending_expiry_at: string | null;
  guest_locale: string | null;
}

export interface OwnerBookingWithProvider extends OwnerBooking {
  provider_name: string | null;
}

const BOOKING_COLUMNS =
  "id, service_name, service_duration_min, service_price, team_member_id, starts_at, ends_at, status, client_name, client_email, client_phone, pending_expiry_at, guest_locale";

/**
 * Bookings for the owner's business, scoped by userId via the owning business.
 * Returns upcoming (now-or-later) active bookings — pending + confirmed —
 * ordered chronologically, with the provider name resolved for team display.
 * Past and cancelled bookings are excluded from this view.
 */
export async function getUpcomingBookings(userId: string): Promise<OwnerBookingWithProvider[]> {
  const business = await getBusinessForUser(userId);
  if (!business) return [];

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [bookingsRes, membersRes] = await Promise.all([
    supabase
      .from("kalendar_bookings")
      .select(BOOKING_COLUMNS)
      .eq("business_id", business.id)
      .in("status", ["pending_confirmation", "confirmed"])
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true }),
    supabase
      .from("kalendar_team_members")
      .select("id, name")
      .eq("business_id", business.id),
  ]);

  const memberName = new Map(
    ((membersRes.data as { id: string; name: string }[] | null) ?? []).map((m) => [m.id, m.name])
  );

  return ((bookingsRes.data as OwnerBooking[] | null) ?? []).map((b) => ({
    ...b,
    provider_name: b.team_member_id ? memberName.get(b.team_member_id) ?? null : null,
  }));
}
