"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import type { DayId } from "@/lib/onboarding/types";
import {
  WEEKDAY_ORDER,
  validateDayRanges,
  BOOKING_WINDOW_OPTIONS,
  type TimeRange,
  type BookingWindowMonths,
  type DayRangesValidationDict,
} from "@/lib/availability/constants";

export type AvailabilityResult =
  | { ok: true; created?: boolean }
  | { ok: false; error: string };

export type WeekHours = Partial<Record<DayId, TimeRange[]>>;

/** The translation slice this action needs for its own (non-day-range) error
 *  messages. Day-range validation messages are a separate dict
 *  (DayRangesValidationDict) consumed by validateDayRanges directly. */
export interface AvailabilityActionDict {
  errNoBusiness: string;
  errInvalidWindow: string;
  errSaveFailed: string;
}

const FALLBACK_ACTION: AvailabilityActionDict = {
  errNoBusiness: "Primero configura tu negocio.",
  errInvalidWindow: "Ventana de reservas no válida.",
  errSaveFailed: "No se pudo guardar:",
};

const FALLBACK_VALIDATION: DayRangesValidationDict = {
  errEndBeforeStart: "La hora de fin debe ser posterior a la de inicio.",
  errOverlap: "Los horarios de un mismo día no pueden solaparse.",
};

/**
 * Saves the whole week atomically: validates every day, then replaces all of the
 * business's hour intervals with the submitted set (delete-all + insert), and
 * persists the booking window. The whole week is confirmed by one button, so a
 * full replace is simpler and race-free versus per-range diffing.
 */
export const saveAvailability = authedAction(
  async (
    session,
    payload: {
      week: WeekHours;
      bookingWindowMonths: number;
      dict?: { action?: Partial<AvailabilityActionDict>; validation?: Partial<DayRangesValidationDict> };
    }
  ): Promise<AvailabilityResult> => {
    const a = { ...FALLBACK_ACTION, ...payload.dict?.action };
    const v0 = { ...FALLBACK_VALIDATION, ...payload.dict?.validation };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: a.errNoBusiness };

    const { week, bookingWindowMonths } = payload;

    if (!BOOKING_WINDOW_OPTIONS.includes(bookingWindowMonths as BookingWindowMonths)) {
      return { ok: false, error: a.errInvalidWindow };
    }

    // Validate each day; build the flat insert set.
    const rows: {
      business_id: string;
      day: DayId;
      start_time: string;
      end_time: string;
      sort_order: number;
    }[] = [];

    let anyInterval = false;
    for (const day of WEEKDAY_ORDER) {
      const ranges = week[day] ?? [];
      const v = validateDayRanges(ranges, v0);
      if (!v.valid) {
        return { ok: false, error: v.error };
      }
      ranges
        .slice()
        .sort((a, b) => a.start.localeCompare(b.start))
        .forEach((r, index) => {
          anyInterval = true;
          rows.push({
            business_id: business.id,
            day,
            start_time: r.start,
            end_time: r.end,
            sort_order: index,
          });
        });
    }

    const supabase = await createClient();

    // Persist booking window.
    const { error: bizErr } = await supabase
      .from("kalendar_businesses")
      .update({ booking_window_months: bookingWindowMonths })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);
    if (bizErr) return { ok: false, error: `${a.errSaveFailed} ${bizErr.message}` };

    // Replace all intervals: delete existing, then insert the new set.
    const { error: delErr } = await supabase
      .from("kalendar_business_hours")
      .delete()
      .eq("business_id", business.id);
    if (delErr) return { ok: false, error: `${a.errSaveFailed} ${delErr.message}` };

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("kalendar_business_hours").insert(rows);
      if (insErr) return { ok: false, error: `${a.errSaveFailed} ${insErr.message}` };
    }

    revalidatePath("/panel");
    revalidatePath("/panel/availability");
    return { ok: true, created: anyInterval };
  }
);
