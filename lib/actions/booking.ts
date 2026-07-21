"use server";

import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getPublicBookingData, getTakenIntervals } from "@/lib/booking/data";
import { buildBookingIcsBase64 } from "@/lib/booking/ics";
import { formatBusinessAddress } from "@/lib/business/data";
import {
  sendEmail,
  bookingConfirmEmailHtml,
  bookingUnderReviewEmailHtml,
  ownerBookingNotificationHtml,
  bookingCancelledClientHtml,
  bookingCancelledOwnerHtml,
  formatBookingWhen,
} from "@/lib/email";
import {
  generateSlotsForDay,
  dayIdInTz,
  BUSINESS_TZ,
} from "@/lib/booking/slots";

// ── Translation slice for guest-facing wizard errors ────────────────────────
// Shared by getAvailableSlots and submitBooking. Sourced from
// lib/i18n/dictionaries/booking-page.ts's `errors` section.
export interface BookingWizardErrorDict {
  errBusinessUnavailable: string;
  errInvalidService: string;
  errInvalidDate: string;
  errNameRequired: string;
  errEmailInvalid: string;
  errInvalidSlot: string;
  errInvalidProvider: string;
  errSlotTaken: string;
  errCreateFailed: string;
}

const FALLBACK_WIZARD_ERRORS: BookingWizardErrorDict = {
  errBusinessUnavailable: "Negocio no disponible.",
  errInvalidService: "Servicio no válido.",
  errInvalidDate: "Fecha no válida.",
  errNameRequired: "Indica tu nombre.",
  errEmailInvalid: "Indica un email válido.",
  errInvalidSlot: "La hora seleccionada no es válida.",
  errInvalidProvider: "Profesional no válido.",
  errSlotTaken: "Ese horario ya no está disponible. Elige otro.",
  errCreateFailed: "No se pudo crear la reserva. Inténtalo de nuevo.",
};

// ── Available slots for a service/provider/date ────────────────────────────
export interface SlotDTO {
  startIso: string; // UTC ISO
  label: string; // "HH:MM" Madrid
  providerId: string | null; // which member this slot is with (null = solo)
  providerName: string | null; // for display in the "Cualquiera" path
}

export type SlotsResult =
  | { ok: true; slotsByDate: Record<string, SlotDTO[]> }
  | { ok: false; error: string };

/**
 * Computes bookable slots for a given service, optional provider, and an
 * inclusive calendar date range [dateFrom, dateTo] (each "YYYY-MM-DD" in the
 * business tz). Public/guest action — no auth. Availability accounts for
 * current pending+confirmed bookings.
 *
 * Fetches taken intervals ONCE per relevant provider for the whole range
 * (not once per day) — generateSlotsForDay is cheap in-memory work, so the
 * per-day loop after that single query is effectively free. This range shape
 * is also what the future chatbot booking interface will call directly,
 * whether for a single day or a wider window.
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
  dateFrom: string; // "YYYY-MM-DD" in business tz
  dateTo: string; // "YYYY-MM-DD" in business tz, inclusive
  dict?: Partial<BookingWizardErrorDict>;
}): Promise<SlotsResult> {
  const t = { ...FALLBACK_WIZARD_ERRORS, ...input.dict };

  const data = await getPublicBookingData(input.slug);
  if (!data) return { ok: false, error: t.errBusinessUnavailable };

  const service = data.services.find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, error: t.errInvalidService };

  const [fy, fm, fd] = input.dateFrom.split("-").map(Number);
  const [ty, tm, td] = input.dateTo.split("-").map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return { ok: false, error: t.errInvalidDate };

  // Enumerate each calendar day in the range as {y, m, d} tuples.
  const days: { y: number; m: number; d: number; ds: string }[] = [];
  const cursor = new Date(Date.UTC(fy, fm - 1, fd));
  const last = new Date(Date.UTC(ty, tm - 1, td));
  if (last < cursor) return { ok: false, error: t.errInvalidDate };
  while (cursor <= last) {
    const y = cursor.getUTCFullYear(), m = cursor.getUTCMonth() + 1, d = cursor.getUTCDate();
    const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ y, m, d, ds });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Widen the taken-intervals query to cover the whole range (±1 day guard
  // for cross-midnight edges), fetched once — not once per day.
  const now = new Date();
  const from = new Date(Date.UTC(fy, fm - 1, fd - 1, 0, 0, 0));
  const to = new Date(Date.UTC(ty, tm - 1, td + 2, 0, 0, 0));

  const isTeam = data.business.team_mode === "team";

  // Solo, or a specific provider chosen: a single taken-intervals fetch,
  // then one generateSlotsForDay call per day in the range.
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
    const slotsByDate: Record<string, SlotDTO[]> = {};
    for (const { y, m, d, ds } of days) {
      const day = dayIdInTz(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)), BUSINESS_TZ);
      const ranges = data.hoursByDay[day] ?? [];
      if (ranges.length === 0) { slotsByDate[ds] = []; continue; }
      const slots = generateSlotsForDay({
        dateInTz: { year: y, month: m, day: d },
        ranges, durationMin: service.duration_min, taken, now,
      });
      slotsByDate[ds] = slots.map((s) => ({
        startIso: s.start.toISOString(), label: s.label,
        providerId: provider, providerName,
      }));
    }
    return { ok: true, slotsByDate };
  }

  // "Cualquiera": one taken-intervals fetch per member for the whole range,
  // then one slot per (day, time, free member), labelled with provider.
  const perMember = await Promise.all(
    data.members.map(async (mem) => {
      const taken = await getTakenIntervals({
        businessId: data.business.id, from, to, teamMemberId: mem.id,
      });
      return { mem, taken };
    })
  );

  const slotsByDate: Record<string, SlotDTO[]> = {};
  for (const { y, m, d, ds } of days) {
    const day = dayIdInTz(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)), BUSINESS_TZ);
    const ranges = data.hoursByDay[day] ?? [];
    if (ranges.length === 0) { slotsByDate[ds] = []; continue; }

    const out: SlotDTO[] = [];
    for (const { mem, taken } of perMember) {
      const slots = generateSlotsForDay({
        dateInTz: { year: y, month: m, day: d },
        ranges, durationMin: service.duration_min, taken, now,
      });
      for (const s of slots) {
        out.push({ startIso: s.start.toISOString(), label: s.label, providerId: mem.id, providerName: mem.name });
      }
    }
    // Sort by time, then provider name, so same-time options group together.
    out.sort(
      (a, b) =>
        a.startIso.localeCompare(b.startIso) ||
        (a.providerName ?? "").localeCompare(b.providerName ?? "")
    );
    slotsByDate[ds] = out;
  }
  return { ok: true, slotsByDate };
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
  // Optional free-text comment from whoever's booking, shown to the clinic.
  notes?: string;
  guestLocale: "es" | "en";
  // When set, the booking is for an authenticated patient: status is 'confirmed'
  // immediately, pending_expiry_at is null, and patient_id is stored.
  patientId?: string | null;
  // Admin-tooling escape hatch only (e.g. the appointment generator): forces
  // a specific status instead of deriving it from patientId. Never set by
  // the real public booking wizard.
  statusOverride?: "confirmed" | "pending_confirmation";
  dict?: Partial<BookingWizardErrorDict>;
}): Promise<SubmitResult> {
  const t = { ...FALLBACK_WIZARD_ERRORS, ...input.dict };

  const data = await getPublicBookingData(input.slug);
  if (!data) return { ok: false, error: t.errBusinessUnavailable };

  const service = data.services.find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, error: t.errInvalidService };

  const name = input.clientName.trim();
  const email = input.clientEmail.trim();
  const phone = input.clientPhone.trim();
  const notes = (input.notes ?? "").trim();
  if (name.length < 2) return { ok: false, error: t.errNameRequired };
  if (!EMAIL_RE.test(email)) return { ok: false, error: t.errEmailInvalid };

  const start = new Date(input.startIso);
  if (Number.isNaN(start.getTime()) || start < new Date()) {
    return { ok: false, error: t.errInvalidSlot };
  }
  const end = new Date(start.getTime() + service.duration_min * 60_000);

  const isTeam = data.business.team_mode === "team";

  const supabase = await createClient();

  // The client now picks an explicit (provider, time) — even on the "Cualquiera"
  // path each slot is a concrete provider. So a team booking must carry a valid
  // member id. Solo businesses still have exactly one kalendar_team_members row
  // (the owner, seeded via ensureOwnerSeeded) — attribute the booking to it
  // rather than leaving team_member_id null, since the panel's week-grid view
  // only renders a booking under a provider column when it matches a real
  // member id (see panel-calendar module / calendar-grid-view.tsx).
  let teamMemberId: string | null = null;
  if (isTeam) {
    if (!input.providerId || !data.members.some((m) => m.id === input.providerId)) {
      return { ok: false, error: t.errInvalidProvider };
    }
    teamMemberId = input.providerId;
  } else {
    const { data: soloMember } = await supabase
      .from("kalendar_team_members")
      .select("id")
      .eq("business_id", data.business.id)
      .eq("is_owner", true)
      .maybeSingle();
    teamMemberId = soloMember?.id ?? null;
  }

  const token = randomBytes(24).toString("base64url");
  const isAuthenticated = !!input.patientId;

  // Authenticated patients: confirmed immediately, no expiry window.
  // Guests: pending_confirmation, clinic has 24h to confirm.
  // statusOverride (admin tooling only) takes precedence over the
  // patientId-derived default when provided.
  const bookingStatus = input.statusOverride ?? (isAuthenticated ? "confirmed" : "pending_confirmation");
  const pendingExpiryAt =
    bookingStatus === "confirmed"
      ? null
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("kalendar_bookings").insert({
    business_id: data.business.id,
    service_id: service.id,
    team_member_id: teamMemberId,
    patient_id: input.patientId ?? null,
    service_name: service.name,
    service_duration_min: service.duration_min,
    service_price: service.price,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    status: bookingStatus,
    pending_expiry_at: pendingExpiryAt,
    client_name: name,
    client_email: email,
    client_phone: phone || null,
    notes: notes || null,
    guest_locale: input.guestLocale,
    confirm_token: token,
  });

  if (error) {
    // Unique active-slot index violation -> the slot was just taken.
    if (error.code === "23505") {
      return { ok: false, error: t.errSlotTaken };
    }
    return { ok: false, error: t.errCreateFailed };
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const cancelUrl = `${base}/bookings/cancel/${token}`;
  const providerName = teamMemberId
    ? data.members.find((mm) => mm.id === teamMemberId)?.name ?? null
    : null;
  const whenLabel = formatBookingWhen(start.toISOString(), input.guestLocale);

  if (bookingStatus === "confirmed") {
    // Authenticated patient: booking is already confirmed. Send a receipt email.
    const ics = buildBookingIcsBase64({
      uid: token,
      summary: `${service.name} - ${data.business.name}`,
      location: formatBusinessAddress(data.business),
      startIso: start.toISOString(),
      durationMin: service.duration_min,
    });
    await sendEmail({
      to: email,
      subject:
        input.guestLocale === "en"
          ? `Booking confirmed · ${data.business.name}`
          : `Cita confirmada · ${data.business.name}`,
      html: bookingConfirmEmailHtml({
        clientName: name,
        businessName: data.business.name,
        serviceName: service.name,
        whenLabel,
        providerName,
        // Authenticated bookings are already confirmed — no confirm link needed.
        // We pass the cancel URL only so the template can show it.
        confirmUrl: cancelUrl, // unused in the authenticated template variant
        cancelUrl,
        // "Gestionar mi cita" sends an authenticated patient to their portal
        // (they have an account), not straight to the guest cancel page.
        manageUrl: `${base}/patient/login?redirectTo=${encodeURIComponent("/patient/bookings")}`,
        locale: input.guestLocale,
        isConfirmed: true,
        hasIcsAttachment: true,
      }),
      attachments: [{ filename: "cita-kalendar.ics", content: ics }],
    });
  } else {
    // Guest booking: send "under review" email — clinic has 24h to confirm.
    await sendEmail({
      to: email,
      subject:
        input.guestLocale === "en"
          ? `Booking request received · ${data.business.name}`
          : `Solicitud de cita recibida · ${data.business.name}`,
      html: bookingUnderReviewEmailHtml({
        clientName: name,
        businessName: data.business.name,
        serviceName: service.name,
        whenLabel,
        providerName,
        cancelUrl,
        locale: input.guestLocale,
      }),
    });
  }

  // Notify the clinic owner of the new booking (Spanish, regardless of guest locale).
  await notifyOwnerOfBooking({
    business_id: data.business.id,
    team_member_id: teamMemberId,
    service_name: service.name,
    starts_at: start.toISOString(),
    client_name: name,
    client_email: email,
    client_phone: phone || null,
    notes: notes || null,
  });

  return { ok: true, token };
}

// ── Confirm a pending booking via tokenized email link ─────────────────────
export type ConfirmResult =
  | { ok: true; status: "confirmed" | "already"; guestLocale: "es" | "en" }
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
    .select(
      "id, status, business_id, team_member_id, service_name, starts_at, client_name, client_email, client_phone, notes, guest_locale"
    )
    .eq("confirm_token", token)
    .maybeSingle();

  if (!booking) return { ok: false, error: "Reserva no encontrada." };
  if (booking.status === "confirmed") {
    return { ok: true, status: "already", guestLocale: booking.guest_locale };
  }
  if (booking.status !== "pending_confirmation") {
    return { ok: false, error: "Esta reserva ya no se puede confirmar." };
  }

  const { error } = await supabase
    .from("kalendar_bookings")
    .update({ status: "confirmed" })
    .eq("id", booking.id)
    .eq("status", "pending_confirmation"); // guard against races

  if (error) return { ok: false, error: "No se pudo confirmar la reserva." };

  // Notify the owner. Best-effort: failures are logged, never block confirmation.
  await notifyOwnerOfBooking(booking);

  return { ok: true, status: "confirmed", guestLocale: booking.guest_locale };
}

/** Sends the owner the "new booking confirmed" email. Best-effort. */
async function notifyOwnerOfBooking(booking: {
  business_id: string;
  team_member_id: string | null;
  service_name: string;
  starts_at: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  notes: string | null;
}): Promise<void> {
  const supabase = await createClient();

  // Business -> owner email + name, plus provider name if any.
  const { data: biz } = await supabase
    .from("kalendar_businesses")
    .select("name, owner_id")
    .eq("id", booking.business_id)
    .maybeSingle();
  if (!biz) return;

  const { data: owner } = await supabase
    .from("user")
    .select("email, emailVerified")
    .eq("id", biz.owner_id)
    .maybeSingle();
  if (!owner?.email) return;

  let providerName: string | null = null;
  if (booking.team_member_id) {
    const { data: member } = await supabase
      .from("kalendar_team_members")
      .select("name")
      .eq("id", booking.team_member_id)
      .maybeSingle();
    providerName = member?.name ?? null;
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  // The [Kalendar] subject prefix is only added for owners with a verified
  // account email — unverified accounts haven't completed onboarding yet.
  const prefix = owner.emailVerified ? "[Kalendar] " : "";
  await sendEmail({
    to: owner.email,
    subject: `${prefix}Nueva cita: ${booking.service_name}`,
    html: ownerBookingNotificationHtml({
      businessName: biz.name,
      serviceName: booking.service_name,
      whenLabel: formatBookingWhen(booking.starts_at),
      clientName: booking.client_name,
      clientEmail: booking.client_email,
      clientPhone: booking.client_phone,
      notes: booking.notes,
      providerName,
      panelUrl: `${base}/panel/calendar`,
    }),
  });
}

// ── Cancellation (client side, via tokenized link) ─────────────────────────
export interface BookingSummary {
  serviceName: string;
  whenLabel: string;
  status: BookingStatusLite;
  businessName: string;
  businessSlug: string;
  providerName: string | null;
  guestLocale: "es" | "en";
}
type BookingStatusLite = "pending_confirmation" | "confirmed" | "cancelled" | "completed";

export type BookingLookupResult =
  | { ok: true; booking: BookingSummary }
  | { ok: false; error: string };

/** Read-only lookup of a booking by token, for the cancel page to display. */
export async function getBookingByToken(token: string): Promise<BookingLookupResult> {
  if (!token || token.length < 10) return { ok: false, error: "Enlace no válido." };
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("kalendar_bookings")
    .select("service_name, starts_at, status, business_id, team_member_id, guest_locale")
    .eq("confirm_token", token)
    .maybeSingle();
  if (!b) return { ok: false, error: "Reserva no encontrada." };

  const { data: biz } = await supabase
    .from("kalendar_businesses")
    .select("name, slug")
    .eq("id", b.business_id)
    .maybeSingle();

  let providerName: string | null = null;
  if (b.team_member_id) {
    const { data: m } = await supabase
      .from("kalendar_team_members")
      .select("name")
      .eq("id", b.team_member_id)
      .maybeSingle();
    providerName = m?.name ?? null;
  }

  return {
    ok: true,
    booking: {
      serviceName: b.service_name,
      whenLabel: formatBookingWhen(b.starts_at, b.guest_locale),
      status: b.status as BookingStatusLite,
      businessName: biz?.name ?? "",
      businessSlug: biz?.slug ?? "",
      providerName,
      guestLocale: b.guest_locale,
    },
  };
}

export type CancelResult =
  | { ok: true; status: "cancelled" | "already" }
  | { ok: false; error: string };

/**
 * Cancels a booking from the client's tokenized link. Public/guest — the token
 * is the authorization. Idempotent. Frees the slot and notifies the owner.
 */
export async function cancelBookingByToken(token: string): Promise<CancelResult> {
  if (!token || token.length < 10) return { ok: false, error: "Enlace no válido." };

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("kalendar_bookings")
    .select(
      "id, status, business_id, team_member_id, service_name, starts_at, client_name, client_email, guest_locale"
    )
    .eq("confirm_token", token)
    .maybeSingle();

  if (!booking) return { ok: false, error: "Reserva no encontrada." };
  if (booking.status === "cancelled") return { ok: true, status: "already" };
  if (!["pending_confirmation", "confirmed"].includes(booking.status)) {
    return { ok: false, error: "Esta reserva ya no se puede cancelar." };
  }

  const { error } = await supabase
    .from("kalendar_bookings")
    .update({ status: "cancelled" })
    .eq("id", booking.id)
    .in("status", ["pending_confirmation", "confirmed"]);
  if (error) return { ok: false, error: "No se pudo cancelar la reserva." };

  // Notify owner + send the client their cancellation receipt. Best-effort.
  await notifyCancellation(booking, false);

  return { ok: true, status: "cancelled" };
}

/**
 * Sends cancellation emails. byOwner=false -> client cancelled (notify owner +
 * client receipt). byOwner=true -> owner cancelled (notify client only).
 * Best-effort; failures are logged, never thrown. The CLIENT receipt is
 * localized to guest_locale; the OWNER notification stays Spanish (no
 * owner-language setting exists yet).
 */
export async function notifyCancellation(
  booking: {
    business_id: string;
    team_member_id: string | null;
    service_name: string;
    starts_at: string;
    client_name: string;
    client_email: string;
    guest_locale?: "es" | "en";
  },
  byOwner: boolean
): Promise<void> {
  const supabase = await createClient();
  const guestLocale = booking.guest_locale ?? "es";

  const { data: biz } = await supabase
    .from("kalendar_businesses")
    .select("name, owner_id")
    .eq("id", booking.business_id)
    .maybeSingle();
  if (!biz) return;

  let providerName: string | null = null;
  if (booking.team_member_id) {
    const { data: m } = await supabase
      .from("kalendar_team_members")
      .select("name")
      .eq("id", booking.team_member_id)
      .maybeSingle();
    providerName = m?.name ?? null;
  }

  const guestWhenLabel = formatBookingWhen(booking.starts_at, guestLocale);
  const ownerWhenLabel = formatBookingWhen(booking.starts_at); // owner emails stay Spanish

  // Always send the client a cancellation receipt, in their own language.
  await sendEmail({
    to: booking.client_email,
    subject:
      guestLocale === "en"
        ? `Booking cancelled · ${biz.name}`
        : `Cita cancelada · ${biz.name}`,
    html: bookingCancelledClientHtml({
      clientName: booking.client_name,
      businessName: biz.name,
      serviceName: booking.service_name,
      whenLabel: guestWhenLabel,
      byOwner,
      locale: guestLocale,
    }),
  });

  // If the client cancelled, also notify the owner (Spanish).
  if (!byOwner) {
    const { data: owner } = await supabase
      .from("user")
      .select("email, emailVerified")
      .eq("id", biz.owner_id)
      .maybeSingle();
    if (owner?.email) {
      const prefix = owner.emailVerified ? "[Kalendar] " : "";
      await sendEmail({
        to: owner.email,
        subject: `${prefix}Cita cancelada: ${booking.service_name}`,
        html: bookingCancelledOwnerHtml({
          serviceName: booking.service_name,
          whenLabel: ownerWhenLabel,
          clientName: booking.client_name,
          providerName,
        }),
      });
    }
  }
}
