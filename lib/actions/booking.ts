"use server";

import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getPublicBookingData, getTakenIntervals } from "@/lib/booking/data";
import {
  generateSlotsForDay,
  dayIdInTz,
  BUSINESS_TZ,
  type Slot,
} from "@/lib/booking/slots";

// ── Available slots for a service/provider/date ────────────────────────────
export interface SlotDTO {
  startIso: string; // UTC ISO
  label: string; // "HH:MM" Madrid
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
 *  - providerId = a member id -> availability vs that member's bookings.
 *  - providerId = null/"any" -> a slot is open if AT LEAST ONE member is free.
 *  Solo businesses ignore providerId (single chair).
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

  // Weekday hours for that calendar day (evaluate the noon instant in tz to get
  // the weekday robustly).
  const noonUtcGuess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = dayIdInTz(noonUtcGuess, BUSINESS_TZ);
  const ranges = data.hoursByDay[day] ?? [];
  if (ranges.length === 0) return { ok: true, slots: [] };

  const now = new Date();
  // Window for taken-interval lookup: the whole calendar day in UTC terms (pad).
  const from = new Date(Date.UTC(y, m - 1, d - 1, 0, 0, 0));
  const to = new Date(Date.UTC(y, m - 1, d + 2, 0, 0, 0));

  const isTeam = data.business.team_mode === "team";

  let slots: Slot[];
  if (!isTeam || input.providerId) {
    // Solo, or a specific provider chosen.
    const taken = await getTakenIntervals({
      businessId: data.business.id,
      from,
      to,
      teamMemberId: isTeam ? input.providerId : null,
    });
    slots = generateSlotsForDay({
      dateInTz: { year: y, month: m, day: d },
      ranges,
      durationMin: service.duration_min,
      taken,
      now,
    });
  } else {
    // "Cualquiera": a slot is open if at least one member is free. Compute each
    // member's free slots and union them.
    const perMember = await Promise.all(
      data.members.map((mem) =>
        getTakenIntervals({ businessId: data.business.id, from, to, teamMemberId: mem.id }).then(
          (taken) =>
            generateSlotsForDay({
              dateInTz: { year: y, month: m, day: d },
              ranges,
              durationMin: service.duration_min,
              taken,
              now,
            })
        )
      )
    );
    const seen = new Set<number>();
    slots = [];
    for (const list of perMember) {
      for (const s of list) {
        const k = s.start.getTime();
        if (!seen.has(k)) {
          seen.add(k);
          slots.push(s);
        }
      }
    }
    slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  return {
    ok: true,
    slots: slots.map((s) => ({ startIso: s.start.toISOString(), label: s.label })),
  };
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

  // Resolve the provider to pin on the booking.
  let teamMemberId: string | null = null;
  if (isTeam) {
    if (input.providerId) {
      if (!data.members.some((m) => m.id === input.providerId)) {
        return { ok: false, error: "Profesional no válido." };
      }
      teamMemberId = input.providerId;
    } else {
      // "Cualquiera": pick the first member free at this exact start.
      const free = await firstFreeMember(data.business.id, data.members.map((m) => m.id), start, end);
      if (!free) return { ok: false, error: "Ese horario ya no está disponible." };
      teamMemberId = free;
    }
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

  // Step 3 will send the confirmation email here.
  return { ok: true, token };
}

/** Returns the id of the first member with no active booking overlapping [start,end). */
async function firstFreeMember(
  businessId: string,
  memberIds: string[],
  start: Date,
  end: Date
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_bookings")
    .select("team_member_id, starts_at, ends_at, status")
    .eq("business_id", businessId)
    .in("status", ["pending_confirmation", "confirmed"])
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString());

  const busy = new Set(
    ((data as { team_member_id: string | null }[] | null) ?? []).map((b) => b.team_member_id)
  );
  for (const id of memberIds) {
    if (!busy.has(id)) return id;
  }
  return null;
}
