import { createClient } from "@/lib/supabase/server";

export type Role = "clinic" | "patient";

/**
 * Assigns a role to a user. Safe to call multiple times — uses upsert so it
 * never errors if the role is already present. Call this at the right entry
 * point for each role:
 *   • 'clinic'  → on sign-up/sign-in via /login
 *   • 'patient' → on sign-up via the booking page auth gate or /patient/login
 */
export async function assignRole(userId: string, role: Role): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
}

/**
 * Returns true if the user holds the given role, false otherwise. Used in
 * middleware and route guards to decide where to redirect.
 */
export async function hasRole(userId: string, role: Role): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  return !!data;
}

/**
 * Returns all roles a user holds. Useful for the "both clinic and patient"
 * scenario — e.g. to decide which portal to redirect to after a generic login.
 */
export async function getUserRoles(userId: string): Promise<Role[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.role as Role);
}
