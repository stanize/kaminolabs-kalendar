"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";

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

/** One member row as the client edits it. id === null means "new, not yet saved". */
export interface TeamMemberInput {
  id: string | null;
  name: string;
  role: string;
}

export interface SaveTeamInput {
  mode: "solo" | "team";
  /** The full roster in display order — the single source of truth on save. */
  members: TeamMemberInput[];
}

export interface SavedTeamMember {
  id: string;
  name: string;
  role: string | null;
  is_owner: boolean;
}

export type SaveTeamResult =
  | { ok: true; members: SavedTeamMember[] }
  | { ok: false; error: string };

/**
 * Atomic whole-roster save (mirrors Disponibilidad's whole-week save): the
 * client edits members locally (add / rename / re-role / delete / reorder /
 * mode switch) and commits everything in one action.
 *
 * Semantics:
 * - `members` is authoritative: existing non-owner rows missing from it are
 *   deleted (their bookings keep working — bookings.team_member_id is
 *   ON DELETE SET NULL), rows with id are updated, rows without id inserted.
 * - sort_order = array index.
 * - The owner row must be present (rename allowed, never deletable).
 * - mode "solo" requires the roster to be just the owner.
 *
 * Not wrapped in a DB transaction (Supabase REST) — statements run in a safe
 * order (mode → deletes → upserts) so a mid-way failure never leaves an
 * invalid roster, only a partially applied edit the user can retry.
 */
export const saveTeam = authedAction(
  async (
    session,
    input: SaveTeamInput,
    dict?: Partial<TeamActionDict>
  ): Promise<SaveTeamResult> => {
    const t = { ...FALLBACK, ...dict };

    if (input.mode !== "solo" && input.mode !== "team") {
      return { ok: false, error: t.errInvalidMode };
    }
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    // Normalize + validate every row up front — reject the whole save on the
    // first invalid row so a partial roster is never written.
    const rows = (input.members ?? []).map((m) => ({
      id: m.id,
      name: (m.name ?? "").trim(),
      role: (m.role ?? "").trim(),
    }));
    for (const r of rows) {
      if (r.name.length < 2) return { ok: false, error: t.errNameRequired };
      if (r.name.length > NAME_MAX) {
        return { ok: false, error: t.errNameTooLong.replace("{max}", String(NAME_MAX)) };
      }
      if (r.role.length > ROLE_MAX) {
        return { ok: false, error: t.errRoleTooLong.replace("{max}", String(ROLE_MAX)) };
      }
    }

    const supabase = await createClient();

    const { data: existingData, error: readError } = await supabase
      .from("kalendar_team_members")
      .select("id, is_owner")
      .eq("business_id", business.id);
    if (readError) {
      return { ok: false, error: `${t.errSaveFailed} ${readError.message}` };
    }
    const existing = existingData ?? [];
    const existingIds = new Set(existing.map((e) => e.id));
    const ownerId = existing.find((e) => e.is_owner)?.id ?? null;

    // Every id the client sends must belong to this business.
    for (const r of rows) {
      if (r.id && !existingIds.has(r.id)) {
        return { ok: false, error: `${t.errSaveFailed} unknown member` };
      }
    }
    // The owner row can be renamed but never removed.
    if (ownerId && !rows.some((r) => r.id === ownerId)) {
      return { ok: false, error: t.errCannotDeleteOwner };
    }
    // Solo mode = just the owner.
    if (input.mode === "solo" && rows.length > 1) {
      return { ok: false, error: t.errCannotGoSolo };
    }

    // 1) Mode.
    if (input.mode !== business.team_mode) {
      const { error } = await supabase
        .from("kalendar_businesses")
        .update({ team_mode: input.mode })
        .eq("id", business.id)
        .eq("owner_id", session.user.id);
      if (error) return { ok: false, error: `${t.errSaveFailed} ${error.message}` };
    }

    // 2) Deletes: existing non-owner members no longer in the roster.
    const keptIds = new Set(rows.filter((r) => r.id).map((r) => r.id as string));
    const toDelete = existing
      .filter((e) => !e.is_owner && !keptIds.has(e.id))
      .map((e) => e.id);
    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("kalendar_team_members")
        .delete()
        .in("id", toDelete)
        .eq("business_id", business.id);
      if (error) return { ok: false, error: `${t.errDeleteFailed} ${error.message}` };
    }

    // 3) Updates + inserts, sort_order = display index.
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.id) {
        const { error } = await supabase
          .from("kalendar_team_members")
          .update({ name: r.name, role: r.role || null, sort_order: i })
          .eq("id", r.id)
          .eq("business_id", business.id);
        if (error) return { ok: false, error: `${t.errSaveFailed} ${error.message}` };
      } else {
        const { error } = await supabase.from("kalendar_team_members").insert({
          business_id: business.id,
          name: r.name,
          role: r.role || null,
          is_owner: false,
          sort_order: i,
        });
        if (error) return { ok: false, error: `${t.errAddFailed} ${error.message}` };
      }
    }

    // Return the saved roster so the client can remap local rows (new rows get
    // their real ids — prevents duplicate inserts on a second save).
    const { data: savedData, error: refetchError } = await supabase
      .from("kalendar_team_members")
      .select("id, name, role, is_owner")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (refetchError) {
      return { ok: false, error: `${t.errSaveFailed} ${refetchError.message}` };
    }

    revalidatePath("/panel");
    revalidatePath("/panel/team");
    return { ok: true, members: (savedData ?? []) as SavedTeamMember[] };
  }
);
