"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth-session";
import { createClient } from "@/lib/supabase/server";
import { incrementRateLimitHit, getClientIp } from "@/lib/rate-limit";
import { getPublicBookingData, getTakenIntervals } from "@/lib/booking/data";
import { buildBookingIcsBase64 } from "@/lib/booking/ics";
import { formatBusinessAddress } from "@/lib/business/data";
import { resolveClinicClientId } from "@/lib/booking/client-link";
import {
  sendEmail,
  bookingConfirmEmailHtml,
  ownerBookingNotificationHtml,
  bookingCancelledClientHtml,
  bookingCancelledOwnerHtml,
  cancellationRequestOwnerHtml,
  cancellationRequestDeniedClientHtml,
  formatBookingWhen,
  EMAIL_LOCALE,
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
  // {code} placeholder — see RATE_LIMIT_CODE below. Deliberately generic
  // wording ("no ha sido posible... en este momento") rather than naming
  // "rate limit" outright: a scripted abuser hitting this shouldn't learn
  // exactly what tripped, while a real person who hits it legitimately
  // (shared clinic wifi, a retried double-submit) has a stable code to
  // quote to support instead of just a dead end.
  errRateLimitedTemplate: string;
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
  errRateLimitedTemplate:
    "No ha sido posible completar tu solicitud en este momento. Código: {code}. Si el problema persiste, contacta con soporte e indica este código.",
};

// Stable, non-obvious code shown to the person and loggable by Arun to
// decode "which limit tripped" without the message itself saying "rate
// limit exceeded" — see errRateLimitedTemplate's comment. One code per
// (endpoint, guest-vs-patient) pair; extend this map rather than the
// generic-sounding prose above if a new limited endpoint is added later.
const RATE_LIMIT_CODE: Record<"guest" | "patient", string> = {
  guest: "BK-4029",
  patient: "BK-4030",
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
  | { ok: true; token: string; status: "confirmed" | "pending_confirmation" }
  // errorDetail carries the raw Postgres error for diagnostic callers (the
  // admin appointment-generator tool). The public wizard never reads it —
  // only `error` (the localized, user-safe message) is shown there.
  | { ok: false; error: string; errorDetail?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Internal implementation — see submitBooking/submitBookingInternal below
// this function for the two thin, purpose-specific exports. Not exported
// itself: keeping the rate-limit bypass out of anything a client component
// could import means it's never wired into the Next.js Server Action
// client-reference manifest, so there's no way to reach it — or the
// skipRateLimit flag — from a browser at all, forged request or not.
async function submitBookingImpl(input: {
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
  // WhatsApp-guest-only signal (set exclusively by
  // lib/whatsapp/conversation.ts's awaitingConfirmation via
  // submitBookingInternal) — passed through to resolveClinicClientId to
  // dedupe by phone instead of always creating a new kalendar_clients row.
  // Never set by the website wizard (submitBooking). See client-link.ts's
  // doc comment for the full rationale.
  matchByPhone?: boolean;
  // When set, the booking is for an authenticated patient: status is 'confirmed'
  // immediately, pending_expiry_at is null, and patient_id is stored.
  patientId?: string | null;
  // Admin-tooling escape hatch only (e.g. the appointment generator): forces
  // a specific status instead of deriving it from patientId. Never set by
  // the real public booking wizard.
  statusOverride?: "confirmed" | "pending_confirmation";
  // Honeypot field (booking-abuse-protection, public-booking.md Phase 1) —
  // an input invisible to real users but visible to naive form-filling
  // bots. Never set by a real person, so any non-empty value here means a
  // bot filled the form. Rejected with a FAKE success below, not a real
  // error — the bot should believe it worked and move on, not learn to
  // look for a different signal to avoid.
  honeypot?: string;
  dict?: Partial<BookingWizardErrorDict>;
}, skipRateLimit: boolean): Promise<SubmitResult> {
  const t = { ...FALLBACK_WIZARD_ERRORS, ...input.dict };

  if (input.honeypot) {
    return { ok: true, token: randomBytes(24).toString("base64url"), status: "confirmed" };
  }

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

  // Re-derive patientId/emailVerified from the actual session rather than
  // fully trusting the client-passed patientId — previously this action
  // accepted any patientId string as-is, which meant a malicious client
  // could create a booking under someone else's patient identity just by
  // passing their id. Now the caller must actually BE that patient's own
  // session for it to count as authenticated at all; otherwise this falls
  // back to the guest path below (name/email typed into the form).
  let verifiedPatientId: string | null = null;
  let emailVerified = false;
  if (input.patientId) {
    const session = await getSession();
    if (session?.user?.id) {
      const { data: patientRow } = await supabase
        .from("kalendar_patients")
        .select("id, user_id")
        .eq("id", input.patientId)
        .maybeSingle();
      if (patientRow && patientRow.user_id === session.user.id) {
        verifiedPatientId = input.patientId;
        emailVerified = session.user.emailVerified === true;
      }
    }
  }
  const isAuthenticated = !!verifiedPatientId;

  // RATE LIMITING (booking-abuse-protection, public-booking.md, design
  // finalized 2026-09-19) — single per-IP-per-day counter for this
  // endpoint, shared across guest and authenticated attempts from that IP,
  // but the ALLOWED THRESHOLD depends on the current request: 5/day for a
  // guest, 10/day for a verified-session patient (isAuthenticated is
  // derived from verifiedPatientId above, never the client-passed
  // patientId — can't be spoofed to claim the higher threshold). Checked
  // AFTER the honeypot/business/service/slot validation above so a
  // malformed request doesn't burn budget, but BEFORE any DB write.
  //
  // EXEMPTION (2026-09-19, Arun): admin tooling — specifically the admin
  // portal's appointment-generator dev tool, reached only via
  // app/api/internal/appointment-gen/route.ts, which is gated on
  // INTERNAL_APPOINTMENT_GEN_SECRET before it ever calls submitBooking —
  // needs to bulk-create many test bookings in one run without tripping
  // this. skipRateLimit (this function's second argument, see
  // submitBookingImpl above) is the signal, set ONLY by
  // submitBookingInternal below — an export that's never imported by any
  // client component, so a browser has no way to reach it or the flag,
  // forged request or not (see submitBookingImpl's own comment). Skips the
  // increment entirely too, not just the threshold check, so admin-tool
  // runs don't pollute the real per-IP counter for that day either.
  if (!skipRateLimit) {
    const ip = getClientIp(await headers());
    const rateLimitThreshold = isAuthenticated ? 10 : 5;
    const rateLimitCount = await incrementRateLimitHit("submit_booking", ip);
    if (rateLimitCount > rateLimitThreshold) {
      const code = RATE_LIMIT_CODE[isAuthenticated ? "patient" : "guest"];
      return { ok: false, error: t.errRateLimitedTemplate.replace("{code}", code) };
    }
  }

  // client-linking-on-booking (clinic-clients-page.md) — best-effort: a
  // failure here should never block the booking itself (clinic_client_id
  // is nullable, degrades gracefully — same as before this existed).
  const clinicClientId = await resolveClinicClientId({
    businessId: data.business.id,
    patientId: verifiedPatientId,
    name,
    email,
    phone: phone || null,
    matchByPhone: input.matchByPhone,
  }).catch(() => null);

  // Every normal-flow booking is confirmed immediately, no review/expiry
  // window — guest, authenticated + verified, AND (as of 2026-09,
  // guest-immediate-confirm-with-clinic-followup extended to cover this
  // case too) authenticated-but-UNVERIFIED patients booking mid-sign-up
  // all get the exact same treatment now. The email-verification gate
  // lives entirely on the ACCOUNT side instead (app/patient/(protected)/
  // layout.tsx's PatientEmailVerificationGate) — an unverified patient's
  // very first booking (made inline during sign-up) goes through same as
  // anyone else's, but they can't re-login and use the portal (view/book
  // again) until they verify. That split is deliberate: the booking is a
  // one-shot action tied to a slot that needs holding NOW, the portal
  // gate is what actually protects against a throwaway-email account
  // getting ongoing unverified access.
  //
  // finalizeVerifiedPatientBookings (lib/actions/patient.ts) — the
  // "promote a pending booking to confirmed on verify" step this
  // subsumed — was removed (2026-09) along with its
  // PatientBookingFinalizer mount point: there's no pending booking left
  // for it to promote through the normal flow anymore.
  //
  // statusOverride (admin tooling only, e.g. the appointment generator) is
  // the one remaining way a pending_confirmation row can still be
  // produced — which is why lib/booking/client-status.ts's
  // guest_unconfirmed branch and its related UI are kept rather than
  // deleted, even though the normal flow can no longer reach it.
  const bookingStatus = input.statusOverride ?? "confirmed";
  // Whether THIS action should send its own "booking confirmed" receipt
  // email. True for everyone EXCEPT an authenticated-but-unverified
  // patient: that one case's email is already fully covered by Better
  // Auth's sendVerificationEmail hook, which fired moments earlier
  // (booking-wizard.tsx's handleRegister -> signUp.email, BEFORE this
  // action even runs) and sends ONE combined "confirm your email + here's
  // your booking" email by reading the same booking details back out of
  // its callbackURL (see lib/auth.ts). Sending a second, separate
  // confirmation email here would be a confusing, redundant duplicate —
  // this is the ONLY thing that distinguishes an unverified patient's
  // booking from anyone else's now; the booking itself is confirmed and
  // the slot held identically either way.
  const shouldSendOwnConfirmEmail = !isAuthenticated || emailVerified;
  const pendingExpiryAt =
    bookingStatus === "confirmed"
      ? null
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("kalendar_bookings").insert({
    business_id: data.business.id,
    service_id: service.id,
    team_member_id: teamMemberId,
    patient_id: verifiedPatientId,
    clinic_client_id: clinicClientId,
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
      return { ok: false, error: t.errSlotTaken, errorDetail: error.message };
    }
    return { ok: false, error: t.errCreateFailed, errorDetail: `${error.code}: ${error.message}` };
  }

  // private-clinic-notes / client-linking-on-booking (clinic-clients-page.md,
  // 2026-09-24): copy a non-empty guest/WhatsApp comment into the client's
  // private note history, clearly attributed to this specific appointment.
  // Only on CREATE (never on edit — there's no edit path here) and only
  // best-effort: a failure here should never affect the booking that was
  // already successfully created above. author_id is null — this note is
  // system-generated from the guest/patient's own comment, not typed by a
  // clinic staff member.
  if (notes && clinicClientId) {
    await supabase.from("kalendar_client_notes").insert({
      client_id: clinicClientId,
      business_id: data.business.id,
      author_id: null,
      body: `Nota de la cita del ${formatBookingWhen(start.toISOString(), "es")} (${service.name}): ${notes}`,
    }).then(({ error: noteError }) => {
      if (noteError) console.error("[submitBookingImpl] client note copy failed", noteError);
    });
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const cancelUrl = `${base}/bookings/cancel/${token}`;
  const providerName = teamMemberId
    ? data.members.find((mm) => mm.id === teamMemberId)?.name ?? null
    : null;
  const whenLabel = formatBookingWhen(start.toISOString(), EMAIL_LOCALE);

  if (bookingStatus === "confirmed" && shouldSendOwnConfirmEmail) {
    // Guest, or authenticated + already-verified patient — send a receipt
    // email. (An authenticated-but-unverified patient is confirmed too,
    // but skips this — see shouldSendOwnConfirmEmail above.) manageUrl
    // differs: only an authenticated patient actually HAS an account to
    // log into — a true guest gets sent to the same token-based
    // cancel/manage page a guest booking always used, not a login screen
    // they have no credentials for.
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
        EMAIL_LOCALE === "en"
          ? `Booking confirmed · ${data.business.name}`
          : `Cita confirmada · ${data.business.name}`,
      html: bookingConfirmEmailHtml({
        clientName: name,
        businessName: data.business.name,
        serviceName: service.name,
        whenLabel,
        providerName,
        // Already confirmed either way — no confirm link needed. We pass
        // the cancel URL only so the template can show it.
        confirmUrl: cancelUrl, // unused in the confirmed template variant
        cancelUrl,
        manageUrl: isAuthenticated
          ? `${base}/patient/login?redirectTo=${encodeURIComponent("/patient/bookings")}`
          : cancelUrl,
        locale: EMAIL_LOCALE,
        isConfirmed: true,
        hasIcsAttachment: true,
        brandColor: data.business.brand_color,
      }),
      attachments: [{ filename: "cita-kalendar.ics", content: ics }],
    });
  } else if (bookingStatus !== "confirmed") {
    // The only way to reach here is admin tooling's statusOverride forcing
    // pending_confirmation on a guest-shaped (patient_id null) row — every
    // normal-flow booking (guest, unverified-patient, or verified-patient)
    // is "confirmed" now (see the derivation above). No email here, same
    // as before this refactor: the old "under review" email this used to
    // send, bookingUnderReviewEmailHtml, no longer exists — real guests
    // never reach this branch.
  }
  // (bookingStatus === "confirmed" && !shouldSendOwnConfirmEmail: the
  // authenticated-but-unverified case — deliberately no email at all here,
  // see shouldSendOwnConfirmEmail's comment above.)

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

  return { ok: true, token, status: bookingStatus };
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

/** Public wizard entry point — always rate-limited. This is the only one
 * of the two exports below that any client component may import. */
export async function submitBooking(
  input: Parameters<typeof submitBookingImpl>[0]
): Promise<SubmitResult> {
  return submitBookingImpl(input, false);
}

/**
 * Admin-tooling entry point ONLY (the appointment-generator dev tool, via
 * app/api/internal/appointment-gen/route.ts — itself gated on
 * INTERNAL_APPOINTMENT_GEN_SECRET). Skips the per-IP rate limit entirely so
 * bulk test-appointment generation doesn't trip it. Never import this from
 * a "use client" component — doing so would make it reachable as a Next.js
 * Server Action from the browser, defeating the whole point of keeping the
 * rate-limit bypass off the client-callable surface.
 */
export async function submitBookingInternal(
  input: Parameters<typeof submitBookingImpl>[0]
): Promise<SubmitResult> {
  return submitBookingImpl(input, true);
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
 * Best-effort; failures are logged, never thrown. Both the CLIENT receipt and
 * the OWNER notification are Spanish for now (EMAIL_LOCALE pin — see
 * lib/email.ts) — guest_locale is still stored on the booking but no longer
 * read here.
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

  const { data: biz } = await supabase
    .from("kalendar_businesses")
    .select("name, owner_id, brand_color")
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

  const guestWhenLabel = formatBookingWhen(booking.starts_at, EMAIL_LOCALE);
  const ownerWhenLabel = formatBookingWhen(booking.starts_at); // owner emails stay Spanish

  // Always send the client a cancellation receipt.
  await sendEmail({
    to: booking.client_email,
    subject:
      EMAIL_LOCALE === "en"
        ? `Booking cancelled · ${biz.name}`
        : `Cita cancelada · ${biz.name}`,
    html: bookingCancelledClientHtml({
      clientName: booking.client_name,
      businessName: biz.name,
      serviceName: booking.service_name,
      whenLabel: guestWhenLabel,
      byOwner,
      locale: EMAIL_LOCALE,
      brandColor: biz.brand_color,
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

/**
 * To the OWNER: a client's self-cancel attempt fell inside the clinic's
 * cancellation window and became a request awaiting approve/deny (see
 * kalendar_bookings.cancellation_requested_at). Called from
 * lib/actions/patient.ts's cancelBookingAsPatient when the window blocks an
 * immediate cancel. Always Spanish — owner-facing, not locale-branched.
 */
export async function notifyCancellationRequested(booking: {
  business_id: string;
  team_member_id: string | null;
  service_name: string;
  starts_at: string;
  client_name: string;
}): Promise<void> {
  const supabase = await createClient();

  const { data: biz } = await supabase
    .from("kalendar_businesses")
    .select("owner_id")
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

  const { data: owner } = await supabase
    .from("user")
    .select("email, emailVerified")
    .eq("id", biz.owner_id)
    .maybeSingle();
  if (!owner?.email) return;

  const prefix = owner.emailVerified ? "[Kalendar] " : "";
  await sendEmail({
    to: owner.email,
    subject: `${prefix}Solicitud de cancelación: ${booking.service_name}`,
    html: cancellationRequestOwnerHtml({
      serviceName: booking.service_name,
      whenLabel: formatBookingWhen(booking.starts_at),
      clientName: booking.client_name,
      providerName,
    }),
  });
}

/**
 * To the CLIENT: the owner denied their cancellation request. Called from
 * lib/actions/booking-owner.ts's reviewCancellationRequest on a deny
 * decision. Mirrors notifyCancellation's client-facing branding/locale
 * handling (business name + brand color in the header, guest_locale for
 * copy) since this is a client-facing transactional email.
 */
export async function notifyCancellationRequestDenied(booking: {
  business_id: string;
  service_name: string;
  starts_at: string;
  client_name: string;
  client_email: string;
  guest_locale?: "es" | "en";
}): Promise<void> {
  const supabase = await createClient();

  const { data: biz } = await supabase
    .from("kalendar_businesses")
    .select("name, brand_color")
    .eq("id", booking.business_id)
    .maybeSingle();
  if (!biz) return;

  const locale = booking.guest_locale ?? EMAIL_LOCALE;
  await sendEmail({
    to: booking.client_email,
    subject:
      locale === "en"
        ? `About your cancellation request · ${biz.name}`
        : `Sobre tu solicitud de cancelación · ${biz.name}`,
    html: cancellationRequestDeniedClientHtml({
      clientName: booking.client_name,
      businessName: biz.name,
      serviceName: booking.service_name,
      whenLabel: formatBookingWhen(booking.starts_at, locale),
      locale,
      brandColor: biz.brand_color,
    }),
  });
}
