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
  team_mode: "solo" | "team";
  booking_window_months: number;
  onboarding_completed_at: string | null;
  created_at: string;
}

const BUSINESS_TABLE = "kalendar_businesses";
const BUSINESS_COLUMNS =
  "id, owner_id, name, type, city, slug, slug_status, slug_flag_reason, slug_reviewed_at, brand_color, team_mode, booking_window_months, onboarding_completed_at, created_at";

/**
 * The business owned by a given user, or null. Always scoped by the userId
 * passed in (never a client-supplied id) — the structural guard for reads.
 * A user has at most one business in the current model; the most recent wins.
 */
export async function getBusinessForUser(userId: string): Promise<Business | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(BUSINESS_TABLE)
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
    .from(BUSINESS_TABLE)
    .select(BUSINESS_COLUMNS)
    .eq("slug", slug)
    .eq("slug_status", "active")
    .maybeSingle();
  return (data as Business | null) ?? null;
}

export interface PublicBusinessListing {
  name: string;
  type: BusinessType;
  city: string | null;
  slug: string;
}

/**
 * All publicly bookable businesses (slug_status = 'active'), most recent
 * first. Used by the public /bookings directory page. Only the fields needed
 * for a listing card are selected — no owner_id or moderation internals.
 */
export async function getActiveBusinesses(): Promise<PublicBusinessListing[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(BUSINESS_TABLE)
    .select("name, type, city, slug")
    .eq("slug_status", "active")
    .order("created_at", { ascending: false });
  return (data as PublicBusinessListing[] | null) ?? [];
}

export interface SetupProgress {
  business: Business | null;
  hasServices: boolean;
  hasActiveHours: boolean;
  hasTeam: boolean;
}

/**
 * Setup-checklist state for the panel home: the user's business plus whether
 * each downstream setup step has any rows yet. Scoped by userId; the per-section
 * checks are skipped entirely when the user has no business. Each check fetches
 * only a count (head:true), never the rows.
 */
export async function getSetupProgress(userId: string): Promise<SetupProgress> {
  const business = await getBusinessForUser(userId);
  if (!business) {
    return { business: null, hasServices: false, hasActiveHours: false, hasTeam: false };
  }

  const supabase = await createClient();
  const businessId = business.id;

  const [servicesRes, hoursRes, teamRes] = await Promise.all([
    supabase
      .from("kalendar_services")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("kalendar_business_hours")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("kalendar_team_members")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
  ]);

  return {
    business,
    hasServices: (servicesRes.count ?? 0) > 0,
    hasActiveHours: (hoursRes.count ?? 0) > 0,
    hasTeam: (teamRes.count ?? 0) > 0,
  };
}
