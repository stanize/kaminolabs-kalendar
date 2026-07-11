"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";

export type UpdateDisplayNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

// Updates the user's preferred display name (kalendar_user_preferences), used
// for the panel greeting. This is deliberately separate from the account's
// Better Auth "name" — it's a soft, always-editable salutation, not the
// account's legal/full name.
export const updateDisplayName = authedAction(
  async (
    session,
    rawName: string,
    dict?: { errRequired: string; errTooLong: string; errSaveFailed: string }
  ): Promise<UpdateDisplayNameResult> => {
    const name = rawName.trim();

    if (name.length < 1) {
      return { ok: false, error: dict?.errRequired ?? "Escribe un nombre." };
    }
    if (name.length > 40) {
      return { ok: false, error: dict?.errTooLong ?? "El nombre es demasiado largo." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_user_preferences")
      .upsert(
        { user_id: session.user.id, preferred_name: name },
        { onConflict: "user_id" }
      );

    if (error) {
      return { ok: false, error: dict?.errSaveFailed ?? "No se pudo guardar el nombre." };
    }

    revalidatePath("/panel");
    return { ok: true, name };
  }
);
