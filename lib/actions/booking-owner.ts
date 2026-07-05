"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import { notifyCancellation } from "@/lib/actions/booking";
import {
  sendEmail,
  formatBookingWhen,
  bookingConfirmEmailHtml,
} from "@/lib/email";

export type OwnerBookingResult = { ok: true } | { ok: false; error: string };

/** The translation slice this action needs for its own error messages. */
export interface BookingOwnerActionDict {
  errNoBusiness: string;
  errNotFound: string;
  errCannotCancel: string;
  errCancelFailed: string;
}

const FALLBACK: BookingOwnerActionDict = {
  errNoBusiness: "No hay negocio.",
  errNotFound: "Reserva no encontrada.",
  errCannotCancel: "Esta reserva ya no se puede cancelar.",
  errCancelFailed: "No se pudo cancelar la reserva.",
};

/**
 * Cancels a booking from the owner side. Scoped to the caller's business, so an
 * owner can only cancel their own bookings. Setting status to 'cancelled' frees
 * the slot (the active-slot unique index excludes cancelled rows). The client is
 * notified by email (best-effort).
 */
export const cancelBookingAsOwner = authedAction(
  async (
    session,
    bookingId: string,
    dict?: Partial<BookingOwnerActionDict>
  ): Promise<OwnerBookingResult> => {
    const t = { ...FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const supabase = await createClient();

    // Read the booking (scoped) before cancelling, for the notification.
    const { data: booking } = await supabase
      .from("kalendar_bookings")
      .select(
        "id, status, business_id, team_member_id, service_name, starts_at, client_name, client_email, guest_locale"
      )
      .eq("id", bookingId)
      .eq("business_id", business.id)
      .maybeSingle();

    if (!booking) return { ok: false, error: t.errNotFound };
    if (!["pending_confirmation", "confirmed"].includes(booking.status)) {
      return { ok: false, error: t.errCannotCancel };
    }

    const { error } = await supabase
      .from("kalendar_bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .eq("business_id", business.id)
      .in("status", ["pending_confirmation", "confirmed"]);

    if (error) return { ok: false, error: t.errCancelFailed };

    // Notify the client their booking was cancelled by the business.
    await notifyCancellation(booking, true);

    revalidatePath("/panel/calendar");
    revalidatePath("/panel");
    return { ok: true };
  }
);

/**
 * Confirms a guest pending booking from the owner side. Transitions
 * pending_confirmation → confirmed, clears the expiry window, and emails the
 * guest a confirmation receipt in their language (best-effort).
 */
export const confirmBookingAsOwner = authedAction(
  async (
    session,
    bookingId: string,
    dict?: Partial<BookingOwnerActionDict>
  ): Promise<OwnerBookingResult> => {
    const t = { ...FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const supabase = await createClient();

    const { data: booking } = await supabase
      .from("kalendar_bookings")
      .select(
        "id, status, business_id, team_member_id, service_name, starts_at, client_name, client_email, guest_locale"
      )
      .eq("id", bookingId)
      .eq("business_id", business.id)
      .maybeSingle();

    if (!booking) return { ok: false, error: t.errNotFound };
    if (booking.status !== "pending_confirmation") {
      return { ok: false, error: t.errCannotCancel };
    }

    const { error } = await supabase
      .from("kalendar_bookings")
      .update({ status: "confirmed", pending_expiry_at: null })
      .eq("id", bookingId)
      .eq("business_id", business.id)
      .eq("status", "pending_confirmation");

    if (error) return { ok: false, error: t.errCancelFailed };

    // Email the guest a confirmation receipt in their language.
    const guestLocale = (booking.guest_locale ?? "es") as "es" | "en";
    const whenLabel = formatBookingWhen(booking.starts_at, guestLocale);
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

    await sendEmail({
      to: booking.client_email,
      subject:
        guestLocale === "en"
          ? `Booking confirmed · ${business.name}`
          : `Reserva confirmada · ${business.name}`,
      html: bookingConfirmEmailHtml({
        clientName: booking.client_name,
        businessName: business.name,
        serviceName: booking.service_name,
        whenLabel,
        confirmUrl: `${base}/bookings/confirm/${bookingId}`, // unused in confirmed variant
        cancelUrl: `${base}/bookings/cancel/${bookingId}`,
        locale: guestLocale,
        isConfirmed: true,
      }),
    });

    revalidatePath("/panel/calendar");
    revalidatePath("/panel");
    return { ok: true };
  }
);
