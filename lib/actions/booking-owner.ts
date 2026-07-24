"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import { notifyCancellation } from "@/lib/actions/booking";
import { getWeekBookings, type WeekViewBooking } from "@/lib/booking/owner-data";
import { buildBookingIcsBase64 } from "@/lib/booking/ics";
import { formatBusinessAddress } from "@/lib/business/data";
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
        "id, status, business_id, team_member_id, service_name, service_duration_min, starts_at, client_name, client_email, guest_locale"
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

    const ics = buildBookingIcsBase64({
      uid: bookingId,
      summary: `${booking.service_name} - ${business.name}`,
      location: formatBusinessAddress(business),
      startIso: booking.starts_at,
      durationMin: booking.service_duration_min,
    });

    await sendEmail({
      to: booking.client_email,
      subject:
        guestLocale === "en"
          ? `Booking confirmed · ${business.name}`
          : `Cita confirmada · ${business.name}`,
      html: bookingConfirmEmailHtml({
        clientName: booking.client_name,
        businessName: business.name,
        serviceName: booking.service_name,
        whenLabel,
        confirmUrl: `${base}/bookings/confirm/${bookingId}`, // unused in confirmed variant
        cancelUrl: `${base}/bookings/cancel/${bookingId}`,
        locale: guestLocale,
        isConfirmed: true,
        hasIcsAttachment: true,
      }),
      attachments: [{ filename: "cita-kalendar.ics", content: ics }],
    });

    revalidatePath("/panel/calendar");
    revalidatePath("/panel");
    return { ok: true };
  }
);

export type BookingResultStatus = "completed" | "no_show" | "cancelled";
export type BookingPaymentStatus = "unpaid" | "paid";

/** The translation slice updateBookingResult needs for its own error messages. */
export interface UpdateBookingResultDict {
  errNoBusiness: string;
  errNotFound: string;
  errUpdateFailed: string;
}

const RESULT_FALLBACK: UpdateBookingResultDict = {
  errNoBusiness: "No hay negocio.",
  errNotFound: "Reserva no encontrada.",
  errUpdateFailed: "No se pudo actualizar la cita.",
};

/**
 * Sets a past booking's result (completed/no-show/cancelled) and payment
 * status (paid/unpaid) from the owner's booking-detail modal. Both are
 * independent of each other — a no-show can still be marked paid (deposit
 * kept), a completed session can be pending payment, etc.
 *
 * NOTE: doesn't yet update kalendar_clients' denormalized session counters
 * (total_sessions/completed_count/etc.) — clinic_client_id isn't populated
 * by any write path yet (manual bookings and the guest wizard don't create/
 * link a client record yet either). Wiring the counters is follow-up work
 * once those write paths exist, so it can be tested against real linked
 * bookings instead of guessed at.
 */
export const updateBookingResult = authedAction(
  async (
    session,
    input: { bookingId: string; status: BookingResultStatus; paymentStatus: BookingPaymentStatus },
    dict?: Partial<UpdateBookingResultDict>
  ): Promise<OwnerBookingResult> => {
    const t = { ...RESULT_FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const supabase = await createClient();

    const { data: booking } = await supabase
      .from("kalendar_bookings")
      .select("id")
      .eq("id", input.bookingId)
      .eq("business_id", business.id)
      .maybeSingle();

    if (!booking) return { ok: false, error: t.errNotFound };

    const { error } = await supabase
      .from("kalendar_bookings")
      .update({ status: input.status, payment_status: input.paymentStatus })
      .eq("id", input.bookingId)
      .eq("business_id", business.id);

    if (error) return { ok: false, error: t.errUpdateFailed };

    revalidatePath("/panel/calendar");
    revalidatePath("/panel");
    return { ok: true };
  }
);

// ── Manual (owner-created) appointment — week grid slot click ──────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The translation slice this action needs for its own error/validation messages. */
export interface ManualBookingActionDict {
  errNoBusiness: string;
  errInvalidService: string;
  errInvalidProvider: string;
  errNameRequired: string;
  errEmailInvalid: string;
  errInvalidSlot: string;
  errSlotTaken: string;
  errCreateFailed: string;
}

const MANUAL_FALLBACK: ManualBookingActionDict = {
  errNoBusiness: "No hay negocio.",
  errInvalidService: "Servicio no válido.",
  errInvalidProvider: "Profesional no válido.",
  errNameRequired: "Indica el nombre del cliente.",
  errEmailInvalid: "Indica un email válido.",
  errInvalidSlot: "La hora seleccionada no es válida.",
  errSlotTaken: "Ese horario ya no está disponible. Elige otro.",
  errCreateFailed: "No se pudo crear la cita. Inténtalo de nuevo.",
};

export type CreateManualBookingResult = { ok: true } | { ok: false; error: string };

/**
 * Creates an appointment directly from the owner's week-grid (walk-in/phone
 * booking) — no guest pending-confirmation window, it's confirmed immediately.
 * Client email is optional: if provided AND sendConfirmationEmail is true, a
 * confirmation email is sent; otherwise no email step runs at all.
 */
export const createBookingAsOwner = authedAction(
  async (
    session,
    input: {
      serviceId: string;
      teamMemberId: string;
      startIso: string;
      clientName: string;
      clientEmail?: string;
      clientPhone?: string;
      notes?: string;
      sendConfirmationEmail: boolean;
    },
    dict?: Partial<ManualBookingActionDict>
  ): Promise<CreateManualBookingResult> => {
    const t = { ...MANUAL_FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const supabase = await createClient();

    const [{ data: service }, { data: member }] = await Promise.all([
      supabase
        .from("kalendar_services")
        .select("id, name, duration_min, price")
        .eq("id", input.serviceId)
        .eq("business_id", business.id)
        .maybeSingle(),
      supabase
        .from("kalendar_team_members")
        .select("id")
        .eq("id", input.teamMemberId)
        .eq("business_id", business.id)
        .maybeSingle(),
    ]);

    if (!service) return { ok: false, error: t.errInvalidService };
    if (!member) return { ok: false, error: t.errInvalidProvider };

    const name = input.clientName.trim();
    if (name.length < 2) return { ok: false, error: t.errNameRequired };

    const email = (input.clientEmail ?? "").trim();
    const wantsEmail = input.sendConfirmationEmail && email.length > 0;
    if (input.sendConfirmationEmail && email.length > 0 && !EMAIL_RE.test(email)) {
      return { ok: false, error: t.errEmailInvalid };
    }

    const start = new Date(input.startIso);
    if (Number.isNaN(start.getTime())) return { ok: false, error: t.errInvalidSlot };
    const end = new Date(start.getTime() + service.duration_min * 60_000);

    // Real time-range overlap check for this provider — the DB's partial
    // unique index (business_id, team_member_id, starts_at) only catches an
    // exact-start-time collision, not a general overlap (e.g. a 50-min
    // appointment at 12:00 doesn't share a starts_at with one at 12:30, but
    // they still overlap). Matters more now that the owner can pick any
    // free time, not just a fixed hourly grid.
    const { data: overlapping } = await supabase
      .from("kalendar_bookings")
      .select("id")
      .eq("business_id", business.id)
      .eq("team_member_id", member.id)
      .in("status", ["pending_confirmation", "confirmed"])
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString())
      .limit(1);
    if (overlapping && overlapping.length > 0) return { ok: false, error: t.errSlotTaken };

    const token = randomBytes(24).toString("base64url");

    const { error } = await supabase.from("kalendar_bookings").insert({
      business_id: business.id,
      service_id: service.id,
      team_member_id: member.id,
      patient_id: null,
      service_name: service.name,
      service_duration_min: service.duration_min,
      service_price: service.price,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: "confirmed",
      pending_expiry_at: null,
      client_name: name,
      client_email: email || `sin-email+${token}@kaminolabs.dev`,
      client_phone: (input.clientPhone ?? "").trim() || null,
      notes: (input.notes ?? "").trim() || null,
      guest_locale: "es",
      confirm_token: token,
    });

    if (error) {
      if (error.code === "23505") return { ok: false, error: t.errSlotTaken };
      return { ok: false, error: t.errCreateFailed };
    }

    if (wantsEmail) {
      const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
      const whenLabel = formatBookingWhen(start.toISOString(), "es");
      const ics = buildBookingIcsBase64({
        uid: token,
        summary: `${service.name} - ${business.name}`,
        location: formatBusinessAddress(business),
        startIso: start.toISOString(),
        durationMin: service.duration_min,
      });
      await sendEmail({
        to: email,
        subject: `Cita confirmada · ${business.name}`,
        html: bookingConfirmEmailHtml({
          clientName: name,
          businessName: business.name,
          serviceName: service.name,
          whenLabel,
          confirmUrl: `${base}/bookings/confirm/${token}`, // unused in confirmed variant
          cancelUrl: `${base}/bookings/cancel/${token}`,
          locale: "es",
          isConfirmed: true,
          hasIcsAttachment: true,
        }),
        attachments: [{ filename: "cita-kalendar.ics", content: ics }],
      });
    }

    revalidatePath("/panel/calendar");
    revalidatePath("/panel");
    return { ok: true };
  }
);

// ── Week navigation refetch ─────────────────────────────────────────────────

/**
 * Refetches just the bookings for a different week range when the owner
 * navigates the week grid — members/hours/services are static per session,
 * so only this needs to hit the DB again.
 */
export const fetchWeekBookings = authedAction(
  async (session, weekStartIso: string, weekEndIso: string): Promise<WeekViewBooking[]> => {
    return getWeekBookings(session.user.id, weekStartIso, weekEndIso);
  }
);
