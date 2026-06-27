import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";

export interface TeamMember {
  id: string;
  business_id: string;
  name: string;
  role: string | null;
  is_owner: boolean;
  sort_order: number;
  created_at: string;
}

const TEAM_COLUMNS = "id, business_id, name, role, is_owner, sort_order, created_at";

/**
 * All team members for the given user's business, ordered for display (owner
 * first via sort_order). Scoped by userId: the business is resolved from
 * owner_id, never a client-passed business_id. Returns [] if no business.
 */
export async function getTeamForUser(userId: string): Promise<TeamMember[]> {
  const business = await getBusinessForUser(userId);
  if (!business) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_team_members")
    .select(TEAM_COLUMNS)
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (data as TeamMember[] | null) ?? [];
}

/**
 * Ensures the owner exists as a team member, seeding from the account name if
 * not. Safe to call during a server-component render (no revalidatePath — unlike
 * the ensureOwnerMember action). Idempotent. Returns nothing.
 */
export async function ensureOwnerSeeded(userId: string, ownerName: string): Promise<void> {
  const business = await getBusinessForUser(userId);
  if (!business) return;

  const supabase = await createClient();
  const { count } = await supabase
    .from("kalendar_team_members")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("is_owner", true);

  if ((count ?? 0) > 0) return;

  await supabase.from("kalendar_team_members").insert({
    business_id: business.id,
    name: ownerName.trim() || "Yo",
    role: null,
    is_owner: true,
    sort_order: 0,
  });
}
