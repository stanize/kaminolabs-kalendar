/**
 * Reserved slugs that businesses may not claim.
 *
 * Public booking pages live under /bookings/{slug}, so these are NOT needed to
 * avoid route collisions (the namespace already prevents that). This list is a
 * vanity/abuse guard: it stops users grabbing handles that imply officialness,
 * impersonate the platform, or are otherwise unsuitable.
 *
 * Extend over time as needed. Matching is exact (case-insensitive) against the
 * full slug — see slug-screen.ts.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "support",
  "help",
  "kalendar",
  "kaminolabs",
  "official",
  "www",
  "api",
  "app",
  "new",
  "test",
  "example",
  "booking",
  "bookings",
  "account",
  "billing",
  "payment",
  "login",
  "signup",
  "contact",
  "info",
  "root",
  "staff",
  "team",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
