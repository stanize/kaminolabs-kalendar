"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";

export type DismissResult = { ok: true } | { ok: false; error: string };

/**
 * Marks onboarding as acknowledged by stamping onboarding_completed_at on the
 * business. Used to permanently dismiss the "¡Todo configurado!" banner on the
 * panel home (it hides whenever this timestamp is set). Idempotent.
 */
export const dismissSetupComplete = authedAction(
  async (session): Promise<DismissResult> => {
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: "No hay negocio." };

    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_businesses")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/panel");
    return { ok: true };
  }
);
