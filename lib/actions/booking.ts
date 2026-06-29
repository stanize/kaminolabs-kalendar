"use server";

import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getPublicBookingData, getTakenIntervals } from "@/lib/booking/data";
import { sendEmail, bookingConfirmEmailHtml, formatBookingWhen } from "@/lib/email";
import {
  generateSlotsForDay,
  dayIdInTz,
  BUSINESS_TZ,
} from "@/lib/booking/slots";

// ── Available slots for a service/provider/date ────────────────────────────
export interface SlotDTO {
  startIso: string; // UTC ISO
  label: string; // "HH:MM" Madrid
  providerId: string | null; // which member this slot is with (null = solo)
  providerName: string | null; // for display in the "Cualquiera" path
}

export type SlotsResult =
  | { ok: true; slots: SlotDTO[] }
  | { ok: false; error: string };

/**
 * Computes bookable slots for a given service, optional provider, and calendar
 * day (the day is identified by a "YYYY-MM-DD" string interpreted in the
 * business tz). Public/guest action — no auth. Availability accounts for current
 * pending+confirmed bookings.
 *
 * Provider semantics (team mode):
 *  - providerId = a member id -> that member's free slots (providerName set).
 *  - providerId = null ("Cualquiera") -> ONE slot per (time, free member), each
 *    labelled with its provider, so the client picks provider+time together.
 *  Solo businesses ignore providerId (single chair, provider null).
 */
export async function getAvailableSlots(input: {
  slug: string;
  serviceId: string;
  providerId: string | null;
  date: string; // "YYYY-MM-DD" in business tz
}): Promise<SlotsResult> {
  const data = await getPublicBookingData(input.slug);
  if (!data) return { ok: false, error: "Negocio no disponible." };

  const service = data.services.find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, error: "Servicio no válido." };

  const [y, m, d] = input.date.split("-").map(Number);
  if (!y || !m || !d) return { ok: false, error: "Fecha no válida." };

  const noonUtcGuess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = dayIdInTz(noonUtcGuess, BUSINESS_TZ);
  const ranges = data.hoursByDay[day] ?? [];
  if (ranges.length === 0) return { ok: true, slots: [] };

  const now = new Date();
  const from = new Date(Date.UTC(y, m - 1, d - 1, 0, 0, 0));
  const to = new Date(Date.UTC(y, m - 1, d + 2, 0, 0, 0));

  const isTeam = data.business.team_mode === "team";

  // Solo, or a specific provider chosen: a single list, provider fixed.
  if (!isTeam || input.providerId) {
    const provider = isTeam ? input.providerId : null;
    const providerName = provider
      ? data.members.find((mm) => mm.id === provider)?.name ?? null
      : null;
    const taken = await getTakenIntervals({
      businessId: data.business.id,
      from,
      to,
      teamMemberId: provider,
    });
    const slots = generateSlotsForDay({
      dateInTz: { year: y, month: m, day: d },
      ranges,
      durationMin: service.duration_min,
      taken,
      now,
    });
    return {
      ok: true,
      slots: slots.map((s) => ({
        startIso: s.start.toISOString(),
        label: s.label,
        providerId: provider,
        providerName,
      })),
    };
  }

  // "Cualquiera": one slot per (time, free member), each labelled with provider.
  const perMember = await Promise.all(
    data.members.map(async (mem) => {
      const taken = await getTakenIntervals({
        businessId: data.business.id,
        from,
        to,
        teamMemberId: mem.id,
      });
      const slots = generateSlotsForDay({
        dateInTz: { year: y, month: m, day: d },
        ranges,
        durationMin: service.duration_min,
        taken,
        now,
      });
      return { mem, slots };
    })
  );

  const out: SlotDTO[] = [];
  for (const { mem, slots } of perMember) {
    for (const s of slots) {
      out.push({
        startIso: s.start.toISOString(),
        label: s.label,
        providerId: mem.id,
        providerName: mem.name,
      });
    }
  }
  // Sort by time, then provider name, so same-time options group together.
  out.sort(
    (a, b) =>
      a.startIso.localeCompare(b.startIso) ||
      (a.providerName ?? "").localeCompare(b.providerName ?? "")
  );
  return { ok: true, slots: out };
}

// ── Submit a booking ───────────────────────────────────────────────────────
export type SubmitResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitBooking(input: {
  slug: string;
  serviceId: string;
  providerId: string | null;
  startIso: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
}): Promise<SubmitResult> {
  const data = await getPublicBookingData(input.slug);
  if (!data) return { ok: false, error: "Negocio no disponible." };

  const service = data.services.find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, error: "Servicio no válido." };

  const name = input.clientName.trim();
  const email = input.clientEmail.trim();
  const phone = input.clientPhone.trim();
  if (name.length < 2) return { ok: false, error: "Indica tu nombre." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Indica un email válido." };

  const start = new Date(input.startIso);
  if (Number.isNaN(start.getTime()) || start < new Date()) {
    return { ok: false, error: "La hora seleccionada no es válida." };
  }
  const end = new Date(start.getTime() + service.duration_min * 60_000);

  const isTeam = data.business.team_mode === "team";

  // The client now picks an explicit (provider, time) — even on the "Cualquiera"
  // path each slot is a concrete provider. So a team booking must carry a valid
  // member id; solo bookings carry none.
  let teamMemberId: string | null = null;
  if (isTeam) {
    if (!input.providerId || !data.members.some((m) => m.id === input.providerId)) {
      return { ok: false, error: "Profesional no válido." };
    }
    teamMemberId = input.providerId;
  }

  const supabase = await createClient();
  const token = randomBytes(24).toString("base64url");

  const { error } = await supabase.from("kalendar_bookings").insert({
    business_id: data.business.id,
    service_id: service.id,
    team_member_id: teamMemberId,
    service_name: service.name,
    service_duration_min: service.duration_min,
    service_price: service.price,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    status: "pending_confirmation",
    client_name: name,
    client_email: email,
    client_phone: phone || null,
    confirm_token: token,
  });

  if (error) {
    // Unique active-slot index violation -> the slot was just taken.
    if (error.code === "23505") {
      return { ok: false, error: "Ese horario ya no está disponible. Elige otro." };
    }
    return { ok: false, error: "No se pudo crear la reserva. Inténtalo de nuevo." };
  }

  // Send the client a confirmation link. The booking stays pending until they
  // click it. Email failure does not roll back the booking (the owner can still
  // see it in the calendar); we just log and proceed.
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const confirmUrl = `${base}/bookings/confirm/${token}`;
  const providerName = teamMemberId
    ? data.members.find((mm) => mm.id === teamMemberId)?.name ?? null
    : null;

  await sendEmail({
    to: email,
    subject: `Confirma tu reserva en ${data.business.name}`,
    html: bookingConfirmEmailHtml({
      clientName: name,
      businessName: data.business.name,
      serviceName: service.name,
      whenLabel: formatBookingWhen(start.toISOString()),
      providerName,
      confirmUrl,
    }),
  });

  return { ok: true, token };
}

// ── Confirm a pending booking via tokenized email link ─────────────────────
export type ConfirmResult =
  | { ok: true; status: "confirmed" | "already" }
  | { ok: false; error: string };

/**
 * Activates a pending booking from the client's email link. Public/guest — the
 * unguessable token is the authorization. Idempotent: confirming an
 * already-confirmed booking reports success ("already"). Cancelled/completed
 * bookings cannot be confirmed.
 */
export async function confirmBooking(token: string): Promise<ConfirmResult> {
  if (!token || token.length < 10) return { ok: false, error: "Enlace no válido." };

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("kalendar_bookings")
    .select("id, status")
    .eq("confirm_token", token)
    .maybeSingle();

  if (!booking) return { ok: false, error: "Reserva no encontrada." };
  if (booking.status === "confirmed") return { ok: true, status: "already" };
  if (booking.status !== "pending_confirmation") {
    return { ok: false, error: "Esta reserva ya no se puede confirmar." };
  }

  const { error } = await supabase
    .from("kalendar_bookings")
    .update({ status: "confirmed" })
    .eq("id", booking.id)
    .eq("status", "pending_confirmation"); // guard against races

  if (error) return { ok: false, error: "No se pudo confirmar la reserva." };

  // Step 4 will notify the owner here.
  return { ok: true, status: "confirmed" };
}
