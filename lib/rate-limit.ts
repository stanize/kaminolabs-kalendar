import { createClient } from "@/lib/supabase/server";

// One value per endpoint that gets its own counter (public-booking.md's
// booking-abuse-protection design: every account/booking-creating endpoint
// gets an independent budget on the same shared mechanism, never a pooled
// one). Only "submit_booking" is wired up today — clinic/patient signup are
// tracked separately as their own not_started steps.
export type RateLimitEndpoint = "submit_booking";

/**
 * Atomically bumps today's (endpoint, ipKey) hit counter and returns the new
 * total, via the increment_rate_limit_hit Postgres function (see
 * supabase/schema_001.sql / schema_subset_008.sql) — a plain upsert can't
 * reference the row's own current value from the Supabase JS client, so this
 * needs to be a function call instead. Always increments, even when the
 * caller ends up rejecting the request over the limit — the counter tracks
 * total attempts for the day, not a budget to restore.
 *
 * Fails OPEN, not closed: an rpc error (infra hiccup) returns 0 rather than
 * throwing, so a rate-limit outage never blocks a real booking. Logged so
 * it's still visible if it happens.
 */
export async function incrementRateLimitHit(
  endpoint: RateLimitEndpoint,
  ipKey: string
): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("increment_rate_limit_hit", {
    p_endpoint: endpoint,
    p_ip_key: ipKey,
  });
  if (error) {
    console.error("[rate-limit] increment failed", { endpoint, ipKey, error: error.message });
    return 0;
  }
  return (data as number) ?? 0;
}

/**
 * Best-effort client IP from Vercel's forwarded header (x-forwarded-for's
 * first entry is the original client). Falls back to a shared "unknown"
 * bucket when the header is missing — rare on Vercel, and this is a coarse
 * abuse gate, not a precise identity system, so a shared fallback bucket is
 * an acceptable degradation rather than something worth failing over.
 */
export function getClientIp(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
