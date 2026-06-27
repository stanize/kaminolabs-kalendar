"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";

export type TeamActionResult =
  | { ok: true; created?: boolean }
  | { ok: false; error: string };

const NAME_MAX = 80;
const ROLE_MAX = 60;

function revalidate() {
  revalidatePath("/panel");
  revalidatePath("/panel/team");
}

/** Resolves the caller's business id (or null). Centralizes owner_id scoping. */
async function resolveBusinessId(userId: string): Promise<string | null> {
  const business = await getBusinessForUser(userId);
  return business?.id ?? null;
}

/**
 * Switches the business between 'solo' and 'team'. Switching to 'solo' is only
 * allowed when at most one member exists (otherwise members would be orphaned).
 */
export const setTeamMode = authedAction(
  async (session, mode: "solo" | "team"): Promise<TeamActionResult> => {
    if (mode !== "solo" && mode !== "team") {
      return { ok: false, error: "Modo no válido." };
    }
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: "Primero configura tu negocio." };

    const supabase = await createClient();

    if (mode === "solo") {
      const { count } = await supabase
        .from("kalendar_team_members")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id);
      if ((count ?? 0) > 1) {
        return {
          ok: false,
          error: "Para cambiar a modo individual, elimina primero a los demás miembros.",
        };
      }
    }

    const { error } = await supabase
      .from("kalendar_businesses")
      .update({ team_mode: mode })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);
    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };

    revalidate();
    return { ok: true };
  }
);

/** Adds a member (team mode only). Appends after the current max sort_order. */
export const createMember = authedAction(
  async (
    session,
    input: { name: string; role: string }
  ): Promise<TeamActionResult> => {
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: "Primero configura tu negocio." };
    if (business.team_mode !== "team") {
      return { ok: false, error: "Activa el modo equipo para añadir miembros." };
    }

    const name = input.name.trim();
    const role = input.role.trim();
    if (name.length < 2) return { ok: false, error: "El nombre del miembro es obligatorio." };
    if (name.length > NAME_MAX) return { ok: false, error: `El nombre no puede superar los ${NAME_MAX} caracteres.` };
    if (role.length > ROLE_MAX) return { ok: false, error: `El rol no puede superar los ${ROLE_MAX} caracteres.` };

    const supabase = await createClient();
    const { data: last } = await supabase
      .from("kalendar_team_members")
      .select("sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (last?.sort_order ?? -1) + 1;

    const { error } = await supabase.from("kalendar_team_members").insert({
      business_id: business.id,
      name,
      role: role || null,
      is_owner: false,
      sort_order: nextOrder,
    });
    if (error) return { ok: false, error: `No se pudo añadir el miembro: ${error.message}` };

    revalidate();
    return { ok: true, created: true };
  }
);

/** Updates a member's name/role. The owner row can be renamed but stays owner. */
export const updateMember = authedAction(
  async (
    session,
    input: { id: string; name: string; role: string }
  ): Promise<TeamActionResult> => {
    const businessId = await resolveBusinessId(session.user.id);
    if (!businessId) return { ok: false, error: "Primero configura tu negocio." };

    const name = input.name.trim();
    const role = input.role.trim();
    if (name.length < 2) return { ok: false, error: "El nombre del miembro es obligatorio." };
    if (name.length > NAME_MAX) return { ok: false, error: `El nombre no puede superar los ${NAME_MAX} caracteres.` };
    if (role.length > ROLE_MAX) return { ok: false, error: `El rol no puede superar los ${ROLE_MAX} caracteres.` };

    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_team_members")
      .update({ name, role: role || null })
      .eq("id", input.id)
      .eq("business_id", businessId);
    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };

    revalidate();
    return { ok: true };
  }
);

/** Deletes a member. The owner cannot be deleted. */
export const deleteMember = authedAction(
  async (session, id: string): Promise<TeamActionResult> => {
    const businessId = await resolveBusinessId(session.user.id);
    if (!businessId) return { ok: false, error: "Primero configura tu negocio." };

    const supabase = await createClient();

    const { data: member } = await supabase
      .from("kalendar_team_members")
      .select("is_owner")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (member?.is_owner) {
      return { ok: false, error: "No puedes eliminar al propietario." };
    }

    const { error } = await supabase
      .from("kalendar_team_members")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) return { ok: false, error: `No se pudo eliminar: ${error.message}` };

    revalidate();
    return { ok: true };
  }
);

/** Persists a new ordering. Owner is kept first by sort_order regardless. */
export const reorderMembers = authedAction(
  async (session, orderedIds: string[]): Promise<TeamActionResult> => {
    const businessId = await resolveBusinessId(session.user.id);
    if (!businessId) return { ok: false, error: "Primero configura tu negocio." };

    const supabase = await createClient();
    const results = await Promise.all(
      orderedIds.map((id, index) =>
        supabase
          .from("kalendar_team_members")
          .update({ sort_order: index })
          .eq("id", id)
          .eq("business_id", businessId)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return { ok: false, error: `No se pudo reordenar: ${failed.error.message}` };

    revalidate();
    return { ok: true };
  }
);
