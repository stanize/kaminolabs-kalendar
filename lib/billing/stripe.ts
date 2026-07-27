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
