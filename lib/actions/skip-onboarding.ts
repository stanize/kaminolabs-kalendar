"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function skipOnboarding(): Promise<{ ok: boolean }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false };

  const supabase = await createClient();

  await supabase
    .from("kalendar_profiles")
    .upsert(
      {
        id:                    session.user.id,
        name:                  session.user.name ?? "",
        email:                 session.user.email ?? "",
        onboarding_skipped_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  return { ok: true };
}
