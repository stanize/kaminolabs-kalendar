"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import { validateService } from "@/lib/services/constants";

export type ServiceActionResult =
  | { ok: true; created?: boolean }
  | { ok: false; error: string };

function revalidate() {
  revalidatePath("/panel");
  revalidatePath("/panel/services");
}

/**
 * Resolves the caller's business id, or null if they have none yet. Centralizes
 * the owner_id -> business_id lookup so every mutation is scoped to the session
 * user's own business and never trusts a client-passed business id.
 */
async function resolveBusinessId(userId: string): Promise<string | null> {
  const business = await getBusinessForUser(userId);
  return business?.id ?? null;
}

// ── Create a single service ────────────────────────────────────────────────
// Returns created:true so the caller can detect the first-service transition
// (count 0 -> 1) for the home return-intent redirect.
export const createService = authedAction(
  async (
    session,
    input: { name: string; duration_min: number; price: number }
  ): Promise<ServiceActionResult> => {
    const businessId = await resolveBusinessId(session.user.id);
    if (!businessId) {
      return { ok: false, error: "Primero configura tu negocio." };
    }

    const v = validateService(input);
    if (!v.valid) return { ok: false, error: v.error };

    const supabase = await createClient();

    // Append at the end: next sort_order after the current max.
    const { data: last } = await supabase
      .from("kalendar_services")
      .select("sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (last?.sort_order ?? -1) + 1;

    const { error } = await supabase.from("kalendar_services").insert({
      business_id: businessId,
      name: v.value.name,
      duration_min: v.value.duration_min,
      price: v.value.price,
      sort_order: nextOrder,
    });

    if (error) return { ok: false, error: `No se pudo crear el servicio: ${error.message}` };

    revalidate();
    return { ok: true, created: true };
  }
);

// ── Create multiple services in one go ─────────────────────────────────────
// Used when the user stages template-derived drafts, customizes them, and
// confirms. The drafts carry their (possibly edited) values, so this validates
// and inserts them directly rather than re-reading any template source.
export const createServices = authedAction(
  async (
    session,
    items: { name: string; duration_min: number; price: number }[]
  ): Promise<ServiceActionResult> => {
    const businessId = await resolveBusinessId(session.user.id);
    if (!businessId) {
      return { ok: false, error: "Primero configura tu negocio." };
    }

    if (!Array.isArray(items) || items.length === 0) {
      return { ok: false, error: "No hay servicios que añadir." };
    }

    // Validate every draft before inserting any; report the first problem.
    const validated = [];
    for (const item of items) {
      const v = validateService(item);
      if (!v.valid) return { ok: false, error: v.error };
      validated.push(v.value);
    }

    const supabase = await createClient();

    const { data: last } = await supabase
      .from("kalendar_services")
      .select("sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextOrder = (last?.sort_order ?? -1) + 1;

    const rows = validated.map((v) => ({
      business_id: businessId,
      name: v.name,
      duration_min: v.duration_min,
      price: v.price,
      sort_order: nextOrder++,
    }));

    const { error } = await supabase.from("kalendar_services").insert(rows);
    if (error) return { ok: false, error: `No se pudieron añadir los servicios: ${error.message}` };

    revalidate();
    return { ok: true, created: true };
  }
);

// ── Update a service ───────────────────────────────────────────────────────
export const updateService = authedAction(
  async (
    session,
    input: { id: string; name: string; duration_min: number; price: number }
  ): Promise<ServiceActionResult> => {
    const businessId = await resolveBusinessId(session.user.id);
    if (!businessId) return { ok: false, error: "Primero configura tu negocio." };

    const v = validateService(input);
    if (!v.valid) return { ok: false, error: v.error };

    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_services")
      .update({
        name: v.value.name,
        duration_min: v.value.duration_min,
        price: v.value.price,
      })
      .eq("id", input.id)
      .eq("business_id", businessId); // scope: only the caller's own service

    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };

    revalidate();
    return { ok: true };
  }
);

// ── Delete a service ───────────────────────────────────────────────────────
export const deleteService = authedAction(
  async (session, id: string): Promise<ServiceActionResult> => {
    const businessId = await resolveBusinessId(session.user.id);
    if (!businessId) return { ok: false, error: "Primero configura tu negocio." };

    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_services")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) return { ok: false, error: `No se pudo eliminar: ${error.message}` };

    revalidate();
    return { ok: true };
  }
);

// ── Reorder services ───────────────────────────────────────────────────────
// Persists a new ordering immediately. Accepts the full ordered list of service
// ids; writes each row's sort_order to its index. All scoped to the caller's
// business, so ids outside it are no-ops.
export const reorderServices = authedAction(
  async (session, orderedIds: string[]): Promise<ServiceActionResult> => {
    const businessId = await resolveBusinessId(session.user.id);
    if (!businessId) return { ok: false, error: "Primero configura tu negocio." };

    const supabase = await createClient();

    const results = await Promise.all(
      orderedIds.map((id, index) =>
        supabase
          .from("kalendar_services")
          .update({ sort_order: index })
          .eq("id", id)
          .eq("business_id", businessId)
      )
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      return { ok: false, error: `No se pudo reordenar: ${failed.error.message}` };
    }

    revalidate();
    return { ok: true };
  }
);
