"use server";

import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, isStripeConfigured } from "@/lib/billing/stripe";
import { getBusinessPricing } from "@/lib/pricing/data";
import { getBusinessForUser } from "@/lib/business/data";

export type BillingActionResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
}

/**
 * Creates a Stripe Checkout Session in `subscription` mode for the caller's
 * business, using a dynamically-priced line item (price_data) so the pricing
 * engine (lib/pricing) stays the single source of pricing truth — see
 * docs/specs/stripe-subscription-billing-spec.md section 4a. Reuses the
 * business's existing stripe_customer_id if one is already on record (e.g.
 * a lapsed clinic resubscribing).
 */
export const createCheckoutSession = authedAction(
  async (session): Promise<BillingActionResult> => {
    if (!isStripeConfigured()) {
      return { ok: false, error: "La facturación no está disponible en este momento." };
    }

    const business = await getBusinessForUser(session.user.id);
    if (!business) {
      return { ok: false, error: "No se encontró tu negocio." };
    }

    const pricing = await getBusinessPricing(business.id);
    if (!pricing) {
      return { ok: false, error: "No se pudo calcular el precio del plan." };
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return { ok: false, error: "La facturación no está disponible en este momento." };
    }

    const supabase = await createClient();
    const { data: bizRow } = await supabase
      .from("kalendar_businesses")
      .select("stripe_customer_id")
      .eq("id", business.id)
      .maybeSingle();

    const base = appBaseUrl();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: bizRow?.stripe_customer_id ?? undefined,
      client_reference_id: business.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: pricing.currency.toLowerCase(),
            unit_amount: Math.round(pricing.price * 100),
            recurring: { interval: "month" },
            product_data: {
              name: `Kalendar — ${business.name}`,
            },
          },
        },
      ],
      success_url: `${base}/panel/payments?status=success`,
      cancel_url: `${base}/panel/payments?status=cancelled`,
    });

    if (!checkoutSession.url) {
      return { ok: false, error: "No se pudo iniciar el pago." };
    }

    return { ok: true, url: checkoutSession.url };
  }
);

/**
 * Redirects the clinic to Stripe's hosted Customer Portal for self-serve card
 * updates, invoice history, and cancellation — no custom UI built for v1, per
 * spec section 8.
 */
export const createBillingPortalSession = authedAction(
  async (session): Promise<BillingActionResult> => {
    if (!isStripeConfigured()) {
      return { ok: false, error: "La facturación no está disponible en este momento." };
    }

    const business = await getBusinessForUser(session.user.id);
    if (!business) {
      return { ok: false, error: "No se encontró tu negocio." };
    }

    const supabase = await createClient();
    const { data: bizRow } = await supabase
      .from("kalendar_businesses")
      .select("stripe_customer_id")
      .eq("id", business.id)
      .maybeSingle();

    if (!bizRow?.stripe_customer_id) {
      return { ok: false, error: "Todavía no tienes una suscripción activa." };
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return { ok: false, error: "La facturación no está disponible en este momento." };
    }

    const base = appBaseUrl();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: bizRow.stripe_customer_id,
      return_url: `${base}/panel/payments`,
    });

    return { ok: true, url: portalSession.url };
  }
);
