"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import type { BusinessClosure } from "@/lib/closures/data";

export type ClosureActionResult =
  | { ok: true; closure: BusinessClosure }
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
    payload: { month: number; day: number; label: string; dict?: Partial<ClosureActionDict> }
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
