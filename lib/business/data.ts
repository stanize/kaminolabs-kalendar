import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { BusinessType } from "@/lib/onboarding/types";

export type SlugStatus = "active" | "pending_review" | "rejected";

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  type: BusinessType;
  legal_id: string | null;
  address_street: string;
  address_number: string;
  address_additional: string | null;
  city: string;
  address_postal_code: string;
  address_province: string;
  address_country: string;
  phone_country_code: string;
  phone_number: string;
  contact_email: string;
  slug: string;
  slug_status: SlugStatus;
  slug_flag_reason: string | null;
  slug_reviewed_at: string | null;
  brand_color: string;
  logo_url: string | null;
  team_mode: "solo" | "team";
  booking_window_months: number;
  cancellation_window_hours: number;
  onboarding_completed_at: string | null;
  created_at: string;
  slug_active: boolean;
  bonos_enabled: boolean;
}

/**
 * Single-line display address, e.g. "Calle Mayor 5, 2D · Madrid". Used on the
 * public booking page header and in booking confirmation emails/ICS files —
 * kept as one shared formatter so both stay in sync.
 */
export function formatBusinessAddress(
  business: Pick<Business, "address_street" | "address_number" | "address_additional" | "city">
): string {
  return [
    `${business.address_street} ${business.address_number}${business.address_additional ? `, ${business.address_additional}` : ""}`,
    business.city,
  ].join(" · ");
}

const BUSINESS_TABLE = "kalendar_businesses";
const BUSINESS_COLUMNS =
  "id, owner_id, name, type, legal_id, address_street, address_number, address_additional, city, address_postal_code, address_province, address_country, phone_country_code, phone_number, contact_email, slug, slug_status, slug_flag_reason, slug_reviewed_at, brand_color, logo_url, team_mode, booking_window_months, cancellation_window_hours, onboarding_completed_at, created_at, slug_active, bonos_enabled";

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
    .eq("slug_active", true)
    .order("created_at", { ascending: false });
  return (data as PublicBusinessListing[] | null) ?? [];
}

/**
 * Full public-routing resolution for /bookings/[slug] (admin-portal-tools.md
 * customer-dashboard, section 3 — the kalendar_slug_history lifecycle).
 * Distinguishes three outcomes a plain 404 can't:
 *  - "active": normal case, render the booking page.
 *  - "inactive": the slug belongs to a real business (moderation-active) but
 *    slug_active is false (admin toggle, non-payment enforcement's public-
 *    page-down tier) — show "temporarily down", deliberately different copy
 *    from "retired" below since this slug may come back.
 *  - "retired": no current business owns this slug, but it's in
 *    kalendar_slug_history — show "no longer active" rather than a bare 404.
 *  - "not_found": neither — genuine 404.
 */
export type PublicSlugRouting =
  | { kind: "active"; business: Business }
  | { kind: "inactive" }
  | { kind: "retired" }
  | { kind: "not_found" };

export async function resolvePublicSlugRouting(slug: string): Promise<PublicSlugRouting> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(BUSINESS_TABLE)
    .select(BUSINESS_COLUMNS)
    .eq("slug", slug)
    .eq("slug_status", "active")
    .maybeSingle();

  const business = (data as Business | null) ?? null;
  if (business) {
    return business.slug_active ? { kind: "active", business } : { kind: "inactive" };
  }

  const { data: retired } = await supabase
    .from("kalendar_slug_history")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  return retired ? { kind: "retired" } : { kind: "not_found" };
}

/**
 * True if `slug` is free to claim — not held by any current business, and
 * not sitting in kalendar_slug_history (a retired string can never be
 * silently reclaimed by an unrelated new signup). Used at every slug
 * creation/change point (onboarding, panel business settings, demo
 * provisioning, and the admin dashboard's slug editor).
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const supabase = await createClient();
  const [{ data: businessClash }, { data: historyClash }] = await Promise.all([
    supabase.from(BUSINESS_TABLE).select("id").eq("slug", slug).maybeSingle(),
    supabase.from("kalendar_slug_history").select("id").eq("slug", slug).maybeSingle(),
  ]);
  return !businessClash && !historyClash;
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
