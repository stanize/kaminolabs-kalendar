"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import type { BusinessClosure } from "@/lib/closures/data";
import { findConflictingBookings, CONFLICT_LIST_CAP, type ConflictingBooking } from "@/lib/closures/conflicts";

/** A capped preview of the existing bookings a proposed closure would overlap —
 *  shown in the "N citas se ven afectadas" confirmation dialog before saving. */
export interface ConflictSummary {
  total: number;
  sample: ConflictingBooking[]; // capped at CONFLICT_LIST_CAP; `total - sample.length` more exist beyond it
}

export type ClosureActionResult =
  | { ok: true; closure: BusinessClosure }
  // existing-bookings-conflict-alert: returned instead of saving when the
  // proposed closure overlaps existing pending/confirmed bookings and the
  // caller hasn't yet passed `confirmed: true`. The UI shows this summary in
  // a dialog and, if the clinic confirms, re-calls with `confirmed: true`.
  | { ok: true; needsConfirmation: true; conflicts: ConflictSummary }
  | { ok: false; error: string };

export type DeleteClosureResult = { ok: true } | { ok: false; error: string };

export interface ClosureActionDict {
  errNoBusiness: string;
  errSaveFailed: string; // prefix; server detail appended
  errDeleteFailed: string; // prefix; server detail appended
  errInvalidRecurringDate: string;
  errInvalidDateRange: string;
  errInvalidTimeRange: string;
  errLabelTooLong: string; // contains "{max}"
}

const FALLBACK: ClosureActionDict = {
  errNoBusiness: "Primero configura tu negocio.",
  errSaveFailed: "No se pudo guardar:",
  errDeleteFailed: "No se pudo eliminar:",
  errInvalidRecurringDate: "La fecha del festivo no es válida.",
  errInvalidDateRange: "El rango de fechas no es válido.",
  errInvalidTimeRange: "El horario no es válido.",
  errLabelTooLong: "El nombre no puede superar los {max} caracteres.",
};

const LABEL_MAX = 80;

function tmpl(s: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s);
}

/** Creates a recurring "festivo" (annual public holiday): clinic-wide,
 *  month + day only, no year. */
export const createFestivo = authedAction(
  async (
    session,
    payload: {
      month: number;
      day: number;
      label: string;
      // existing-bookings-conflict-alert: false (default) checks for
      // conflicts first and returns them instead of saving; the UI re-calls
      // with true once the clinic confirms "Guardar de todas formas".
      confirmed?: boolean;
      dict?: Partial<ClosureActionDict>;
    }
  ): Promise<ClosureActionResult> => {
    const d = { ...FALLBACK, ...payload.dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness };

    const { month, day, label } = payload;
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) {
      return { ok: false, error: d.errInvalidRecurringDate };
    }
    if (label.length > LABEL_MAX) {
      return { ok: false, error: tmpl(d.errLabelTooLong, { max: String(LABEL_MAX) }) };
    }

    if (!payload.confirmed) {
      // Recurring festivos only need checking within the business's actual
      // booking window — nothing can be booked further out than that, so
      // checking beyond it is pointless.
      const horizonEnd = new Date();
      horizonEnd.setUTCMonth(horizonEnd.getUTCMonth() + business.booking_window_months);
      const conflicts = await findConflictingBookings(
        business.id,
        { recurring: true, month, day, teamMemberId: null },
        horizonEnd
      );
      if (conflicts.length > 0) {
        return {
          ok: true,
          needsConfirmation: true,
          conflicts: { total: conflicts.length, sample: conflicts.slice(0, CONFLICT_LIST_CAP) },
        };
      }
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("kalendar_business_closures")
      .insert({
        business_id: business.id,
        team_member_id: null,
        recurring: true,
        month,
        day,
        label: label.trim() || null,
      })
      .select()
      .single();

    if (error) return { ok: false, error: `${d.errSaveFailed} ${error.message}` };

    revalidatePath("/panel/availability");
    return { ok: true, closure: data as BusinessClosure };
  }
);

/** Updates an existing recurring festivo in place (day/month/label) — same
 *  validation and check-then-confirm conflict flow as createFestivo, just an
 *  update instead of an insert. Scoped to the caller's own business (never
 *  trusts a client-passed id without an ownership check). */
export const updateFestivo = authedAction(
  async (
    session,
    payload: {
      id: string;
      month: number;
      day: number;
      label: string;
      // existing-bookings-conflict-alert: see createFestivo's doc comment.
      confirmed?: boolean;
      dict?: Partial<ClosureActionDict>;
    }
  ): Promise<ClosureActionResult> => {
    const d = { ...FALLBACK, ...payload.dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness };

    const { id, month, day, label } = payload;
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) {
      return { ok: false, error: d.errInvalidRecurringDate };
    }
    if (label.length > LABEL_MAX) {
      return { ok: false, error: tmpl(d.errLabelTooLong, { max: String(LABEL_MAX) }) };
    }

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("kalendar_business_closures")
      .select("id")
      .eq("id", id)
      .eq("business_id", business.id)
      .eq("recurring", true)
      .maybeSingle();
    if (!existing) return { ok: false, error: d.errNoBusiness };

    if (!payload.confirmed) {
      // Checked against the NEW day/month being saved — same reasoning as
      // createFestivo's own check (the horizon is the business's own
      // booking window, nothing can be booked further out than that).
      const horizonEnd = new Date();
      horizonEnd.setUTCMonth(horizonEnd.getUTCMonth() + business.booking_window_months);
      const conflicts = await findConflictingBookings(
        business.id,
        { recurring: true, month, day, teamMemberId: null },
        horizonEnd
      );
      if (conflicts.length > 0) {
        return {
          ok: true,
          needsConfirmation: true,
          conflicts: { total: conflicts.length, sample: conflicts.slice(0, CONFLICT_LIST_CAP) },
        };
      }
    }

    const { data, error } = await supabase
      .from("kalendar_business_closures")
      .update({ month, day, label: label.trim() || null })
      .eq("id", id)
      .eq("business_id", business.id)
      .select()
      .single();

    if (error) return { ok: false, error: `${d.errSaveFailed} ${error.message}` };

    revalidatePath("/panel/availability");
    return { ok: true, closure: data as BusinessClosure };
  }
);

/** Creates a one-off closure: a real date range, optional same-day
 *  partial-hours window, optionally scoped to one team member (null =
 *  clinic-wide). Used for both the Equipo per-provider time off UI and any
 *  future clinic-wide one-off closure entry point. */
export const createTimeOff = authedAction(
  async (
    session,
    payload: {
      teamMemberId: string | null;
      startDate: string;
      endDate: string;
      startTime?: string | null;
      endTime?: string | null;
      label: string;
      // existing-bookings-conflict-alert: see createFestivo's doc comment.
      confirmed?: boolean;
      dict?: Partial<ClosureActionDict>;
    }
  ): Promise<ClosureActionResult> => {
    const d = { ...FALLBACK, ...payload.dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness };

    const { teamMemberId, startDate, endDate, label } = payload;
    const startTime = payload.startTime || null;
    const endTime = payload.endTime || null;

    if (!startDate || !endDate || endDate < startDate) {
      return { ok: false, error: d.errInvalidDateRange };
    }
    // Partial-hours window is only meaningful (and only allowed) on a
    // single-day entry — matches the workflow doc's v1 scope.
    if ((startTime || endTime) && startDate !== endDate) {
      return { ok: false, error: d.errInvalidTimeRange };
    }
    if (startTime && endTime && endTime <= startTime) {
      return { ok: false, error: d.errInvalidTimeRange };
    }
    if (label.length > LABEL_MAX) {
      return { ok: false, error: tmpl(d.errLabelTooLong, { max: String(LABEL_MAX) }) };
    }

    // If scoped to a team member, verify it belongs to this business —
    // never trust a client-passed id without checking ownership.
    if (teamMemberId) {
      const supabase = await createClient();
      const { data: member } = await supabase
        .from("kalendar_team_members")
        .select("id")
        .eq("id", teamMemberId)
        .eq("business_id", business.id)
        .maybeSingle();
      if (!member) return { ok: false, error: d.errNoBusiness };
    }

    if (!payload.confirmed) {
      // One-off closure: check only within its own date/time range (and,
      // when provider-scoped, only that provider's bookings) — the horizon
      // arg is irrelevant here since the closure already carries a real
      // date range, but the shared window builder wants one; pass the end
      // date itself so it's a no-op ceiling.
      const horizonEnd = new Date(`${endDate}T23:59:59Z`);
      horizonEnd.setUTCDate(horizonEnd.getUTCDate() + 1);
      const conflicts = await findConflictingBookings(
        business.id,
        { recurring: false, startDate, endDate, startTime, endTime, teamMemberId },
        horizonEnd
      );
      if (conflicts.length > 0) {
        return {
          ok: true,
          needsConfirmation: true,
          conflicts: { total: conflicts.length, sample: conflicts.slice(0, CONFLICT_LIST_CAP) },
        };
      }
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("kalendar_business_closures")
      .insert({
        business_id: business.id,
        team_member_id: teamMemberId,
        recurring: false,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
        label: label.trim() || null,
      })
      .select()
      .single();

    if (error) return { ok: false, error: `${d.errSaveFailed} ${error.message}` };

    revalidatePath("/panel/availability");
    revalidatePath("/panel/team");
    return { ok: true, closure: data as BusinessClosure };
  }
);

export const deleteClosure = authedAction(
  async (
    session,
    payload: { id: string; dict?: Partial<ClosureActionDict> }
  ): Promise<DeleteClosureResult> => {
    const d = { ...FALLBACK, ...payload.dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness };

    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_business_closures")
      .delete()
      .eq("id", payload.id)
      .eq("business_id", business.id);

    if (error) return { ok: false, error: `${d.errDeleteFailed} ${error.message}` };

    revalidatePath("/panel/availability");
    revalidatePath("/panel/team");
    return { ok: true };
  }
);
