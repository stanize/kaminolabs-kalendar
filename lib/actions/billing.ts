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
    const existingCustomerId = bizRow?.stripe_customer_id ?? undefined;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: existingCustomerId,
      // Stripe rejects passing customer_email together with an existing
      // customer (the email is already on file for that customer), so this
      // only applies on first-time checkout. Prefer the business's client-
      // facing contact_email (Negocio page); fall back to the owner's
      // Better Auth account email if that's somehow empty.
      customer_email: existingCustomerId
        ? undefined
        : (business.contact_email || session.user.email || undefined),
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
      success_url: `${base}/panel/settings/subscription?status=success`,
      cancel_url: `${base}/panel/settings/subscription?status=cancelled`,
    });

    if (!checkoutSession.url) {
      return { ok: false, error: "No se pudo iniciar el pago." };
    }

    return { ok: true, url: checkoutSession.url };
  }
);

export type BillingPlainResult = { ok: true } | { ok: false; error: string };

/**
 * Resolves the caller's business and its stripe_customer_id/subscription_id
 * in one place — shared by every action below that needs them, so the
 * "no Stripe configured" / "no business" / "no subscription yet" error
 * messages stay consistent.
 */
async function requireBusinessBillingRow(
  userId: string
): Promise<
  | { ok: true; businessId: string; customerId: string; subscriptionId: string }
  | { ok: false; error: string }
> {
  const business = await getBusinessForUser(userId);
  if (!business) {
    return { ok: false, error: "No se encontró tu negocio." };
  }

  const supabase = await createClient();
  const { data: bizRow } = await supabase
    .from("kalendar_businesses")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", business.id)
    .maybeSingle();

  if (!bizRow?.stripe_customer_id || !bizRow?.stripe_subscription_id) {
    return { ok: false, error: "Todavía no tienes una suscripción activa." };
  }

  return {
    ok: true,
    businessId: business.id,
    customerId: bizRow.stripe_customer_id,
    subscriptionId: bizRow.stripe_subscription_id,
  };
}

/**
 * Portal session deep-linked straight to the card-update step (flow_data),
 * rather than the general portal home — used by the native in-app payments
 * page's "Actualizar" button so the person lands directly on the one thing
 * they clicked for. Card entry itself still happens on Stripe's hosted page
 * (never touches Kalendar's servers), same PCI-avoidance rationale as
 * Checkout.
 */
export const createUpdatePaymentMethodSession = authedAction(
  async (session): Promise<BillingActionResult> => {
    if (!isStripeConfigured()) {
      return { ok: false, error: "La facturación no está disponible en este momento." };
    }
    const resolved = await requireBusinessBillingRow(session.user.id);
    if (!resolved.ok) return resolved;

    const stripe = getStripeClient();
    if (!stripe) {
      return { ok: false, error: "La facturación no está disponible en este momento." };
    }

    const base = appBaseUrl();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: resolved.customerId,
      return_url: `${base}/panel/settings/subscription`,
      flow_data: {
        type: "payment_method_update",
      },
    });

    return { ok: true, url: portalSession.url };
  }
);

/**
 * Soft cancel — sets cancel_at_period_end so the subscription stays active
 * (and billable) through the period the clinic already paid for, then
 * Stripe cancels it automatically at the period boundary and fires
 * customer.subscription.deleted (see the webhook route). Does NOT call
 * stripe.subscriptions.cancel() (immediate cancel) — that would end access
 * the clinic already paid for.
 */
export const cancelSubscription = authedAction(
  async (session): Promise<BillingPlainResult> => {
    if (!isStripeConfigured()) {
      return { ok: false, error: "La facturación no está disponible en este momento." };
    }
    const resolved = await requireBusinessBillingRow(session.user.id);
    if (!resolved.ok) return resolved;

    const stripe = getStripeClient();
    if (!stripe) {
      return { ok: false, error: "La facturación no está disponible en este momento." };
    }

    try {
      await stripe.subscriptions.update(resolved.subscriptionId, {
        cancel_at_period_end: true,
      });
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo cancelar la suscripción. Inténtalo de nuevo." };
    }
  }
);

/** Undoes a pending cancellation, before the current period ends. */
export const resumeSubscription = authedAction(
  async (session): Promise<BillingPlainResult> => {
    if (!isStripeConfigured()) {
      return { ok: false, error: "La facturación no está disponible en este momento." };
    }
    const resolved = await requireBusinessBillingRow(session.user.id);
    if (!resolved.ok) return resolved;

    const stripe = getStripeClient();
    if (!stripe) {
      return { ok: false, error: "La facturación no está disponible en este momento." };
    }

    try {
      await stripe.subscriptions.update(resolved.subscriptionId, {
        cancel_at_period_end: false,
      });
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo reanudar la suscripción. Inténtalo de nuevo." };
    }
  }
);

/**
 * Redirects the clinic to Stripe's hosted Customer Portal home — kept as a
 * fallback / "view everything on Stripe" escape hatch even though the native
 * subscription tab (app/panel/settings/subscription) is now the primary UI.
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
      return_url: `${base}/panel/settings/subscription`,
    });

    return { ok: true, url: portalSession.url };
  }
);
