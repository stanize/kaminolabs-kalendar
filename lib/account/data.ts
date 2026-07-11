import { createClient } from "@/lib/supabase/server";

// Per-user app-level preferences (kalendar_user_preferences). Currently just
// preferred_name — a soft display name for panel greetings, distinct from the
// account's Better Auth "name". Intentionally lean; expand this file if more
// per-user preferences show up (e.g. on a future /panel/settings page).

export async function getPreferredName(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_user_preferences")
    .select("preferred_name")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.preferred_name ?? null;
}
