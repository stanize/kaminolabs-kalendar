"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";

export type OwnerBookingResult = { ok: true } | { ok: false; error: string };

/**
 * Cancels a booking from the owner side. Scoped to the caller's business, so an
 * owner can only cancel their own bookings. Setting status to 'cancelled' frees
 * the slot (the active-slot unique index excludes cancelled rows). Client-facing
 * cancellation emails are handled in Step 5.
 */
export const cancelBookingAsOwner = authedAction(
  async (session, bookingId: string): Promise<OwnerBookingResult> => {
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: "No hay negocio." };

    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .eq("business_id", business.id)
      .in("status", ["pending_confirmation", "confirmed"]);

    if (error) return { ok: false, error: "No se pudo cancelar la reserva." };

    revalidatePath("/panel/calendar");
    revalidatePath("/panel");
    return { ok: true };
  }
);
