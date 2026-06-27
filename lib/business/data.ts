import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { BusinessType } from "@/lib/onboarding/types";

export type SlugStatus = "active" | "pending_review" | "rejected";

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  type: BusinessType;
  city: string | null;
  slug: string;
  slug_status: SlugStatus;
  slug_flag_reason: string | null;
  slug_reviewed_at: string | null;
  brand_color: string;
  created_at: string;
}

const BUSINESS_COLUMNS =
  "id, owner_id, name, type, city, slug, slug_status, slug_flag_reason, slug_reviewed_at, brand_color, created_at";

/**
 * The business owned by a given user, or null. Always scoped by the userId
 * passed in (never a client-supplied id) — the structural guard for reads.
 * A user has at most one business in the current model; the most recent wins.
 */
export async function getBusinessForUser(userId: string): Promise<Business | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_businesses")
    .select(BUSINESS_COLUMNS)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Business | null) ?? null;
}

/**
 * A publicly bookable business by slug, or null. Only returns rows whose slug
 * has cleared moderation (slug_status = 'active'); pending/rejected slugs are
 * not public. Used by the public /bookings/[slug] page.
 */
export async function getActiveBusinessBySlug(slug: string): Promise<Business | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_businesses")
    .select(BUSINESS_COLUMNS)
    .eq("slug", slug)
    .eq("slug_status", "active")
    .maybeSingle();
  return (data as Business | null) ?? null;
}
