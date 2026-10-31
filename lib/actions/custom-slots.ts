"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import type { CustomTimeSlotRule } from "@/lib/custom-slots/data";
import type { DayId } from "@/lib/onboarding/types";

export type CustomTimeSlotResult =
  | { ok: true; rule: CustomTimeSlotRule }
  | { ok: false; error: string };

export type DeleteCustomTimeSlotResult = { ok: true } | { ok: false; error: string };

export interface CustomTimeSlotActionDict {
  errNoBusiness: string;
  errSaveFailed: string;
  errDeleteFailed: string;
  errTimesRequired: string;
  errInvalidTime: string; // contains "{time}"
  errInvalidDay: string;
  errInvalidProvider: string;
  errLabelTooLong: string; // contains "{max}"
}

const FALLBACK: CustomTimeSlotActionDict = {
  errNoBusiness: "Primero configura tu negocio.",
  errSaveFailed: "No se pudo guardar:",
  errDeleteFailed: "No se pudo eliminar:",
  errTimesRequired: "Añade al menos un horario.",
  errInvalidTime: "La hora \"{time}\" no es válida.",
  errInvalidDay: "Día no válido.",
  errInvalidProvider: "Uno de los profesionales elegidos no existe.",
  errLabelTooLong: "El nombre no puede superar los {max} caracteres.",
};

const LABEL_MAX = 80;
const VALID_DAYS: DayId[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const TIME_RE = /^\d{2}:\d{2}$/;

function tmpl(s: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s);
}

interface RulePayload {
  label: string;
  days: DayId[]; // empty = all
  teamMemberIds: string[]; // empty = all
  times: string[];
  dict?: Partial<CustomTimeSlotActionDict>;
}

async function validateAndNormalize(
  businessId: string,
  payload: RulePayload,
  d: CustomTimeSlotActionDict
): Promise<{ ok: true; days: string[]; teamMemberIds: string[]; times: string[]; label: string | null } | { ok: false; error: string }> {
  if (payload.label.length > LABEL_MAX) {
    return { ok: false, error: tmpl(d.errLabelTooLong, { max: String(LABEL_MAX) }) };
  }
  for (const day of payload.days) {
    if (!VALID_DAYS.includes(day)) return { ok: false, error: d.errInvalidDay };
  }
  const times = payload.times.map((t) => t.trim()).filter(Boolean);
  if (times.length === 0) return { ok: false, error: d.errTimesRequired };
  for (const t of times) {
    if (!TIME_RE.test(t)) return { ok: false, error: tmpl(d.errInvalidTime, { time: t }) };
  }

  if (payload.teamMemberIds.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("kalendar_team_members")
      .select("id")
      .eq("business_id", businessId)
      .in("id", payload.teamMemberIds);
    const found = new Set((data ?? []).map((m: { id: string }) => m.id));
    if (payload.teamMemberIds.some((id) => !found.has(id))) {
      return { ok: false, error: d.errInvalidProvider };
    }
  }

  return {
    ok: true,
    days: [...new Set(payload.days)],
    teamMemberIds: [...new Set(payload.teamMemberIds)],
    times,
    label: payload.label.trim() || null,
  };
}

function toRule(row: {
  id: string;
  business_id: string;
  label: string | null;
  days: string[] | null;
  team_member_ids: string[] | null;
  times: string[] | null;
  sort_order: number;
  created_at: string;
}): CustomTimeSlotRule {
  return {
    id: row.id,
    businessId: row.business_id,
    label: row.label,
    days: (row.days ?? []) as DayId[],
    teamMemberIds: row.team_member_ids ?? [],
    times: row.times ?? [],
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

const RULE_COLUMNS = "id, business_id, label, days, team_member_ids, times, sort_order, created_at";

export const createCustomTimeSlotRule = authedAction(
  async (session, payload: RulePayload): Promise<CustomTimeSlotResult> => {
    const d = { ...FALLBACK, ...payload.dict };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness };

    const validated = await validateAndNormalize(business.id, payload, d);
    if (!validated.ok) return validated;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("kalendar_custom_time_slots")
      .insert({
        business_id: business.id,
        label: validated.label,
        days: validated.days,
        team_member_ids: validated.teamMemberIds,
        times: validated.times,
      })
      .select(RULE_COLUMNS)
      .single();

    if (error || !data) return { ok: false, error: `${d.errSaveFailed} ${error?.message ?? ""}`.trim() };

    revalidatePath("/panel/availability/custom-slots");
    return { ok: true, rule: toRule(data) };
  }
);

export const updateCustomTimeSlotRule = authedAction(
  async (session, payload: RulePayload & { ruleId: string }): Promise<CustomTimeSlotResult> => {
    const d = { ...FALLBACK, ...payload.dict };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness };

    const validated = await validateAndNormalize(business.id, payload, d);
    if (!validated.ok) return validated;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("kalendar_custom_time_slots")
      .update({
        label: validated.label,
        days: validated.days,
        team_member_ids: validated.teamMemberIds,
        times: validated.times,
      })
      .eq("id", payload.ruleId)
      .eq("business_id", business.id)
      .select(RULE_COLUMNS)
      .single();

    if (error || !data) return { ok: false, error: `${d.errSaveFailed} ${error?.message ?? ""}`.trim() };

    revalidatePath("/panel/availability/custom-slots");
    return { ok: true, rule: toRule(data) };
  }
);

export const deleteCustomTimeSlotRule = authedAction(
  async (
    session,
    ruleId: string,
    dict?: Partial<CustomTimeSlotActionDict>
  ): Promise<DeleteCustomTimeSlotResult> => {
    const d = { ...FALLBACK, ...dict };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness };

    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_custom_time_slots")
      .delete()
      .eq("id", ruleId)
      .eq("business_id", business.id);

    if (error) return { ok: false, error: `${d.errDeleteFailed} ${error.message}`.trim() };

    revalidatePath("/panel/availability/custom-slots");
    return { ok: true };
  }
);
