"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import { notifyCancellation } from "@/lib/actions/booking";

export type OwnerBookingResult = { ok: true } | { ok: false; error: string };

/**
 * Cancels a booking from the owner side. Scoped to the caller's business, so an
 * owner can only cancel their own bookings. Setting status to 'cancelled' frees
 * the slot (the active-slot unique index excludes cancelled rows). The client is
 * notified by email (best-effort).
 */
export const cancelBookingAsOwner = authedAction(
  async (session, bookingId: string): Promise<OwnerBookingResult> => {
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: "No hay negocio." };

    const supabase = await createClient();

    // Read the booking (scoped) before cancelling, for the notification.
    const { data: booking } = await supabase
      .from("kalendar_bookings")
      .select(
        "id, status, business_id, team_member_id, service_name, starts_at, client_name, client_email"
      )
      .eq("id", bookingId)
      .eq("business_id", business.id)
      .maybeSingle();

    if (!booking) return { ok: false, error: "Reserva no encontrada." };
    if (!["pending_confirmation", "confirmed"].includes(booking.status)) {
      return { ok: false, error: "Esta reserva ya no se puede cancelar." };
    }

    const { error } = await supabase
      .from("kalendar_bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .eq("business_id", business.id)
      .in("status", ["pending_confirmation", "confirmed"]);

    if (error) return { ok: false, error: "No se pudo cancelar la reserva." };

    // Notify the client their booking was cancelled by the business.
    await notifyCancellation(booking, true);

    revalidatePath("/panel/calendar");
    revalidatePath("/panel");
    return { ok: true };
  }
);
