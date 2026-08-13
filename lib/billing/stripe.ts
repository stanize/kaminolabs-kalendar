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

/**
 * Free-trial cutoff for a new signup (workflows/subscription-billing.md's
 * trial-period-mechanism): 3 months from signup, ALWAYS rounded UP to the
 * next 1st-of-month (never less than 3 months, per Arun's decision) — so
 * the trial lines up with calendar-aligned billing (nextBillingCycleAnchorUnix
 * above) and a converting trial rolls straight into the same aligned cycle
 * instead of creating an off-cycle subscription.
 *
 * Example: sign up Jan 20 -> raw 3-month mark is Apr 20 -> rounds up to
 * May 1st (not Apr 1st, which would be under 3 months).
 * Example: sign up on the 1st -> raw 3-month mark is already the 1st of a
 * month -> no rounding needed, used as-is.
 *
 * Returns a Unix timestamp (seconds), as Stripe's trial_end expects.
 */
export function trialEndFromSignup(signupDate: Date = new Date()): number {
  const raw = new Date(
    Date.UTC(
      signupDate.getUTCFullYear(),
      signupDate.getUTCMonth() + 3,
      signupDate.getUTCDate(),
      signupDate.getUTCHours(),
      signupDate.getUTCMinutes(),
      signupDate.getUTCSeconds()
    )
  );
  const alreadyFirst = raw.getUTCDate() === 1;
  const trialEnd = alreadyFirst
    ? Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), 1)
    : Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth() + 1, 1);
  return Math.floor(trialEnd / 1000);
}
