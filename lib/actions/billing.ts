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
 *
 * NOT currently wired into the UI — createSubscriptionIntent (below) is the
 * primary subscribe flow as of 2026-07-29 (in-app modal, matching
 * payment-method-modal.tsx). Kept as a working fallback in case the in-app
 * flow needs to be bypassed for some payment method Elements doesn't support
 * well, or a support/admin flow wants a plain link instead of a modal.
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

export type SubscriptionIntentResult =
  | { ok: true; clientSecret: string; mode: "payment" | "setup"; amountDue: number }
  | { ok: false; error: string };

/**
 * Creates the Stripe customer (if needed) and subscription directly, for the
 * in-app subscribe modal — replaces createCheckoutSession as the primary
 * flow (kept below as an unused-but-available fallback). Uses
 * payment_behavior: 'default_incomplete' so the subscription exists in
 * Stripe immediately but stays 'incomplete' until the client confirms
 * payment via Elements.
 *
 * Two cases, both returned as a client secret for the same <PaymentElement>
 * to confirm against:
 *   - Normal price (> 0): Stripe generates an invoice + PaymentIntent for the
 *     first charge. Client calls stripe.confirmPayment().
 *   - $0 first invoice (e.g. a 100%-off onboarding discount phase — see
 *     lib/pricing): there's nothing to charge yet, so Stripe has nothing to
 *     attach a PaymentIntent to. It attaches a pending_setup_intent instead,
 *     purely to collect + save a card for when the discount ends. Client
 *     calls stripe.confirmSetup() instead.
 *
 * KNOWN TRADE-OFF vs the old Checkout-based flow: a Stripe Subscription
 * object is created here immediately, even if the clinic then closes the
 * modal without paying — unlike an abandoned Checkout Session, which never
 * creates a Subscription at all. Stripe auto-cancels unpaid
 * 'default_incomplete' subscriptions after 23 hours, so this self-cleans,
 * but a business row can show a real (if short-lived) stripe_subscription_id
 * with subscription_status='incomplete' from an abandoned attempt. This is
 * not meaningfully different from today's already-existing 'incomplete'
 * default state, so treated as acceptable rather than worked around.
 */
export const createSubscriptionIntent = authedAction(
  async (session): Promise<SubscriptionIntentResult> => {
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

    let customerId = bizRow?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: business.contact_email || session.user.email || undefined,
        name: business.name,
        metadata: { business_id: business.id },
      });
      customerId = customer.id;
      // Persist immediately so a retry (e.g. modal reopened after a failed
      // first attempt) reuses this customer instead of creating another.
      await supabase
        .from("kalendar_businesses")
        .update({ stripe_customer_id: customerId })
        .eq("id", business.id);
    }

    // Unlike Checkout's line_items.price_data, a subscription item's
    // price_data requires a real Product id — inline product_data isn't
    // supported here. Creating one Product per subscribe attempt is the
    // direct equivalent of what Checkout did for us automatically before.
    const product = await stripe.products.create({
      name: `Kalendar — ${business.name}`,
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price_data: {
            currency: pricing.currency.toLowerCase(),
            unit_amount: Math.round(pricing.price * 100),
            recurring: { interval: "month" },
            product: product.id,
          },
        },
      ],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
        payment_method_types: ["card"],
      },
      expand: ["latest_invoice", "pending_setup_intent"],
    });

    // Persist the subscription id right away — there's no Checkout Session
    // completion event to hang this on in this flow, unlike the old
    // createCheckoutSession path (see the trade-off note above).
    await supabase
      .from("kalendar_businesses")
      .update({ stripe_subscription_id: subscription.id })
      .eq("id", business.id);

    // Stripe omits client_secret from PaymentIntent/SetupIntent objects when
    // they arrive nested inside another resource (e.g.
    // subscription.pending_setup_intent, invoice's embedded intent) — a
    // deliberate safeguard against leaking secrets via unrelated expands.
    // client_secret is only populated on a DIRECT retrieve of that intent by
    // its own id. Both branches below re-fetch directly rather than trusting
    // the nested object from subscriptions.create's response.
    //
    // Check pending_setup_intent FIRST: per Stripe's own subscription-
    // integration pattern, when the customer has no default payment method
    // yet, Stripe routes through a SetupIntent-first flow to collect+attach
    // a card — even for a non-zero first invoice — and then automatically
    // charges that invoice once the card is attached as the default payment
    // method (since payment_settings.save_default_payment_method is set to
    // 'on_subscription' above). Confirmed via diagnostics 2026-07-29: a real
    // €49 invoice still came back with a pending_setup_intent rather than an
    // invoice-level confirmation secret.
    const setupIntentRef = subscription.pending_setup_intent;
    const setupIntentId = setupIntentRef
      ? typeof setupIntentRef === "string"
        ? setupIntentRef
        : setupIntentRef.id
      : null;

    if (setupIntentId) {
      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
      if (setupIntent.client_secret) {
        return {
          ok: true,
          clientSecret: setupIntent.client_secret,
          mode: "setup",
          amountDue: pricing.price,
        };
      }
    }

    // Fallback: a real PaymentIntent-backed invoice (no setup-first routing).
    const invoiceRef = subscription.latest_invoice;
    const invoiceId = invoiceRef
      ? typeof invoiceRef === "string"
        ? invoiceRef
        : invoiceRef.id
      : null;

    const invoice = invoiceId ? await stripe.invoices.retrieve(invoiceId) : null;
    const confirmationSecret = invoice?.confirmation_secret ?? null;

    if (confirmationSecret?.client_secret) {
      return {
        ok: true,
        clientSecret: confirmationSecret.client_secret,
        mode: "payment",
        amountDue: pricing.price,
      };
    }

    console.error("[createSubscriptionIntent] no usable client secret found", {
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      invoiceId,
      invoiceStatus: invoice?.status ?? null,
      invoiceTotal: invoice?.total ?? null,
      hasConfirmationSecret: Boolean(confirmationSecret),
      setupIntentId,
    });

    return { ok: false, error: "No se pudo iniciar la suscripción." };
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

export type SetupIntentResult =
  | { ok: true; clientSecret: string }
  | { ok: false; error: string };

/**
 * Creates a Stripe SetupIntent so the client can collect a new card via
 * Stripe Elements (PaymentElement) in an in-app modal, instead of redirecting
 * to Stripe's hosted portal — per Arun's request to match an in-app update
 * flow (e.g. Claude.ai's own "Payment method" modal). Card entry still
 * happens inside Stripe's own iframe (Elements), never touching Kalendar's
 * servers — same PCI-avoidance rationale as Checkout, just without the
 * full-page redirect.
 */
export const createSetupIntent = authedAction(
  async (session): Promise<SetupIntentResult> => {
    if (!isStripeConfigured()) {
      return { ok: false, error: "La facturación no está disponible en este momento." };
    }
    const resolved = await requireBusinessBillingRow(session.user.id);
    if (!resolved.ok) return resolved;

    const stripe = getStripeClient();
    if (!stripe) {
      return { ok: false, error: "La facturación no está disponible en este momento." };
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: resolved.customerId,
      payment_method_types: ["card"],
    });

    if (!setupIntent.client_secret) {
      return { ok: false, error: "No se pudo iniciar la actualización del método de pago." };
    }

    return { ok: true, clientSecret: setupIntent.client_secret };
  }
);

/**
 * Called after the client confirms the SetupIntent (card entered + validated
 * via Stripe Elements) — sets the resulting payment method as the customer's
 * default, so future renewals and the payments page's display both pick it
 * up. Re-derives the customer/subscription from the session rather than
 * trusting a client-passed customer id.
 */
export const setDefaultPaymentMethod = authedAction(
  async (session, paymentMethodId: string): Promise<BillingPlainResult> => {
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
      await stripe.customers.update(resolved.customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo actualizar el método de pago. Inténtalo de nuevo." };
    }
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
