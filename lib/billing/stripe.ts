import Stripe from "stripe";

/**
 * Env-gated Stripe client, same graceful-degrade philosophy as lib/email.ts:
 * if STRIPE_SECRET_KEY is unset (local dev, or before the env var is set in
 * Vercel), billing features should degrade rather than hard-crash.
 *
 * Required env vars for real use:
 *   - STRIPE_SECRET_KEY    → server-side secret key (sk_test_... / sk_live_...)
 *   - STRIPE_WEBHOOK_SECRET → signing secret for app/api/webhooks/stripe (whsec_...)
 *
 * Build/test entirely against Stripe TEST mode first — see
 * docs/specs/stripe-subscription-billing-spec.md section 10.
 */
let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cachedClient) {
    cachedClient = new Stripe(key, {
      apiVersion: "2025-08-27.basil",
    });
  }
  return cachedClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Every Kalendar subscription bills on the 1st of the month, regardless of
 * signup date — a deliberate product decision (workflows/subscription-
 * billing.md's calendar-aligned-billing step) over Stripe's default
 * per-clinic anniversary billing, for operational simplicity: one billing
 * day, one "who's overdue" check, no per-clinic period-start tracking
 * needed anywhere downstream (this is what makes feature-gating's "day 15"
 * a fixed calendar date instead of per-clinic math).
 *
 * Returns the Unix timestamp (seconds, as Stripe's billing_cycle_anchor
 * expects) for the next 1st-of-month at UTC midnight — "next" meaning today
 * if today already IS the 1st, otherwise the 1st of the following month.
 * billing_cycle_anchor must be now-or-future, so "today if it's the 1st"
 * avoids passing a same-day-but-technically-past timestamp depending on
 * time-of-day.
 *
 * Passed to stripe.subscriptions.create({ billing_cycle_anchor: ... }) —
 * Stripe then automatically prorates the first (partial) period up to this
 * date and bills the full amount on this date and every 1st thereafter.
 */
export function nextBillingCycleAnchorUnix(now: Date = new Date()): number {
  const isFirstAlready = now.getUTCDate() === 1;
  const anchor = isFirstAlready
    ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    : Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.floor(anchor / 1000);
}
