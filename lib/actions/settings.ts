"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";

export type UpdateCancellationWindowResult =
  | { ok: true }
  | { ok: false; error: string };

export interface CancellationWindowActionDict {
  errNoBusiness: string;
  errInvalidValue: string;
  errSaveFailed: string;
}

const FALLBACK: CancellationWindowActionDict = {
  errNoBusiness: "Primero configura tu negocio.",
  errInvalidValue: "Introduce un número de horas válido (entre 0 y 720).",
  errSaveFailed: "No se pudo guardar el ajuste.",
};

const MIN_HOURS = 0;
const MAX_HOURS = 720; // 30 days — matches the schema's check constraint

/**
 * How close to an appointment a patient can still self-cancel immediately
 * (see patient-portal.md's self-service-cancel and
 * calendar-management-upcoming.md's cancellation-request-review, the latter
 * not yet built — this setting exists ahead of that consumer so it's ready
 * once the approval flow reads it instead of a hardcoded window).
 *
 * 0 means the window is effectively disabled: self-cancel is always
 * immediate, matching today's behavior before this setting existed.
 */
export const updateCancellationWindow = authedAction(
  async (
    session,
    hours: number,
    dict?: Partial<CancellationWindowActionDict>
  ): Promise<UpdateCancellationWindowResult> => {
    const t = { ...FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    if (!Number.isInteger(hours) || hours < MIN_HOURS || hours > MAX_HOURS) {
      return { ok: false, error: t.errInvalidValue };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_businesses")
      .update({ cancellation_window_hours: hours })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);

    if (error) return { ok: false, error: t.errSaveFailed };

    revalidatePath("/panel/settings/bookings");
    return { ok: true };
  }
);
