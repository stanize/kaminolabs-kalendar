"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import type { TeamMember } from "@/lib/team/data";

const NAME_MAX = 80;
const ROLE_MAX = 60;

/** The translation slice these actions need for their own error messages. */
export interface TeamActionDict {
  errInvalidMode: string;
  errNoBusiness: string;
  errCannotGoSolo: string;
  errSaveFailed: string;
  errTeamModeRequired: string;
  errNameRequired: string;
  errNameTooLong: string; // contains "{max}"
  errRoleTooLong: string; // contains "{max}"
  errAddFailed: string;
  errCannotDeleteOwner: string;
  errDeleteFailed: string;
  errReorderFailed: string;
}

const FALLBACK: TeamActionDict = {
  errInvalidMode: "Modo no válido.",
  errNoBusiness: "Primero configura tu negocio.",
  errCannotGoSolo: "Para cambiar a modo individual, elimina primero a los demás miembros.",
  errSaveFailed: "No se pudo guardar:",
  errTeamModeRequired: "Activa el modo equipo para añadir miembros.",
  errNameRequired: "El nombre del miembro es obligatorio.",
  errNameTooLong: "El nombre no puede superar los {max} caracteres.",
  errRoleTooLong: "El rol no puede superar los {max} caracteres.",
  errAddFailed: "No se pudo añadir el miembro:",
  errCannotDeleteOwner: "No puedes eliminar al propietario.",
  errDeleteFailed: "No se pudo eliminar:",
  errReorderFailed: "No se pudo reordenar:",
};

function tmpl(s: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s);
}

function validateNameRole(name: string, role: string, d: TeamActionDict): string | null {
  if (name.length < 2) return d.errNameRequired;
  if (name.length > NAME_MAX) return tmpl(d.errNameTooLong, { max: String(NAME_MAX) });
  if (role.length > ROLE_MAX) return tmpl(d.errRoleTooLong, { max: String(ROLE_MAX) });
  return null;
}

export type TeamActionResult = { ok: true; member: TeamMember } | { ok: false; error: string };

/**
 * team-member-lifecycle (2026-11-01, per Arun): the Equipo page no longer
 * batches edits behind a single "Guardar cambios" — every action (mode
 * switch, add, edit, delete/disable, reorder) commits immediately via its
 * own action below.
 */
export const setTeamMode = authedAction(
  async (session, payload: { mode: "solo" | "team"; dict?: Partial<TeamActionDict> }) => {
    const d = { ...FALLBACK, ...payload.dict };
    if (payload.mode !== "solo" && payload.mode !== "team") {
      return { ok: false, error: d.errInvalidMode } as const;
    }
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness } as const;

    if (payload.mode === "solo") {
      const supabase = await createClient();
      const { count } = await supabase
        .from("kalendar_team_members")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("is_owner", false);
      if ((count ?? 0) > 0) return { ok: false, error: d.errCannotGoSolo } as const;
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_businesses")
      .update({ team_mode: payload.mode })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);
    if (error) return { ok: false, error: `${d.errSaveFailed} ${error.message}` } as const;

    revalidatePath("/panel/team");
    return { ok: true } as const;
  }
);

export const createTeamMember = authedAction(
  async (
    session,
    payload: {
      name: string;
      role: string;
      professionalDni: string;
      professionalCollegeNumber: string;
      professionalTitle: string;
      dict?: Partial<TeamActionDict>;
    }
  ): Promise<TeamActionResult> => {
    const d = { ...FALLBACK, ...payload.dict };
    const name = payload.name.trim();
    const role = payload.role.trim();
    const invalid = validateNameRole(name, role, d);
    if (invalid) return { ok: false, error: invalid };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness };
    if (business.team_mode !== "team") return { ok: false, error: d.errTeamModeRequired };

    const supabase = await createClient();
    const { count } = await supabase
      .from("kalendar_team_members")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id);

    const { data, error } = await supabase
      .from("kalendar_team_members")
      .insert({
        business_id: business.id,
        name,
        role: role || null,
        is_owner: false,
        sort_order: count ?? 0,
        professional_dni: payload.professionalDni.trim() || null,
        professional_college_number: payload.professionalCollegeNumber.trim() || null,
        professional_title: payload.professionalTitle.trim() || null,
      })
      .select()
      .single();
    if (error) return { ok: false, error: `${d.errAddFailed} ${error.message}` };

    revalidatePath("/panel/team");
    return { ok: true, member: data as TeamMember };
  }
);

export const updateTeamMember = authedAction(
  async (
    session,
    payload: {
      id: string;
      name: string;
      role: string;
      professionalDni: string;
      professionalCollegeNumber: string;
      professionalTitle: string;
      dict?: Partial<TeamActionDict>;
    }
  ): Promise<TeamActionResult> => {
    const d = { ...FALLBACK, ...payload.dict };
    const name = payload.name.trim();
    const role = payload.role.trim();
    const invalid = validateNameRole(name, role, d);
    if (invalid) return { ok: false, error: invalid };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("kalendar_team_members")
      .update({
        name,
        role: role || null,
        professional_dni: payload.professionalDni.trim() || null,
        professional_college_number: payload.professionalCollegeNumber.trim() || null,
        professional_title: payload.professionalTitle.trim() || null,
      })
      .eq("id", payload.id)
      .eq("business_id", business.id)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: `${d.errSaveFailed} ${error.message}` };
    if (!data) return { ok: false, error: d.errNoBusiness };

    revalidatePath("/panel");
    revalidatePath("/panel/team");
    return { ok: true, member: data as TeamMember };
  }
);

export type DeleteOrDisableResult =
  | { ok: true; outcome: "deleted" }
  | { ok: true; outcome: "disabled"; member: TeamMember }
  | { ok: false; error: string };

/**
 * team-member-lifecycle: a member can only be hard-deleted if they have
 * never had a single booking (any status, past or future) — the minute a
 * booking references them, deleting would orphan/mislabel that booking's
 * history. In that case this disables the member instead (active=false):
 * kept for historical lookups (invoices, past bookings' provider name) but
 * excluded from new-booking provider pickers (public booking page +
 * clinic calendar).
 */
export const deleteOrDisableTeamMember = authedAction(
  async (session, payload: { id: string; dict?: Partial<TeamActionDict> }): Promise<DeleteOrDisableResult> => {
    const d = { ...FALLBACK, ...payload.dict };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness };

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("kalendar_team_members")
      .select("id, is_owner")
      .eq("id", payload.id)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!existing) return { ok: false, error: d.errNoBusiness };
    if ((existing as { is_owner: boolean }).is_owner) return { ok: false, error: d.errCannotDeleteOwner };

    const { count: bookingCount, error: countError } = await supabase
      .from("kalendar_bookings")
      .select("id", { count: "exact", head: true })
      .eq("team_member_id", payload.id);
    if (countError) return { ok: false, error: `${d.errDeleteFailed} ${countError.message}` };

    if ((bookingCount ?? 0) > 0) {
      const { data, error } = await supabase
        .from("kalendar_team_members")
        .update({ active: false })
        .eq("id", payload.id)
        .eq("business_id", business.id)
        .select()
        .single();
      if (error) return { ok: false, error: `${d.errDeleteFailed} ${error.message}` };
      revalidatePath("/panel");
      revalidatePath("/panel/team");
      return { ok: true, outcome: "disabled", member: data as TeamMember };
    }

    const { error } = await supabase
      .from("kalendar_team_members")
      .delete()
      .eq("id", payload.id)
      .eq("business_id", business.id);
    if (error) return { ok: false, error: `${d.errDeleteFailed} ${error.message}` };

    revalidatePath("/panel");
    revalidatePath("/panel/team");
    return { ok: true, outcome: "deleted" };
  }
);

export const reactivateTeamMember = authedAction(
  async (session, payload: { id: string; dict?: Partial<TeamActionDict> }): Promise<TeamActionResult> => {
    const d = { ...FALLBACK, ...payload.dict };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("kalendar_team_members")
      .update({ active: true })
      .eq("id", payload.id)
      .eq("business_id", business.id)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: `${d.errSaveFailed} ${error.message}` };
    if (!data) return { ok: false, error: d.errNoBusiness };

    revalidatePath("/panel");
    revalidatePath("/panel/team");
    return { ok: true, member: data as TeamMember };
  }
);

export const reorderTeamMembers = authedAction(
  async (session, payload: { orderedIds: string[]; dict?: Partial<TeamActionDict> }) => {
    const d = { ...FALLBACK, ...payload.dict };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: d.errNoBusiness } as const;

    const supabase = await createClient();
    for (let i = 0; i < payload.orderedIds.length; i++) {
      const { error } = await supabase
        .from("kalendar_team_members")
        .update({ sort_order: i })
        .eq("id", payload.orderedIds[i])
        .eq("business_id", business.id);
      if (error) return { ok: false, error: `${d.errReorderFailed} ${error.message}` } as const;
    }

    revalidatePath("/panel/team");
    return { ok: true } as const;
  }
);
