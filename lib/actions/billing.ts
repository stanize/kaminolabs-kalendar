"use server";

import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, isStripeConfigured, nextBillingCycleAnchorUnix, trialEndFromSignup } from "@/lib/billing/stripe";
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
  async (session, startTrial: boolean = false): Promise<BillingActionResult> => {
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
      // Calendar-aligned billing (workflows/subscription-billing.md) — see
      // the fuller comment on createSubscriptionIntent below, which is the
      // primary subscribe path; this fallback matches it so a clinic ends
      // up on the same billing cycle regardless of which path they went
      // through. startTrial mirrors createSubscriptionIntent's trial_end
      // handling too — without this, a trial signup that happened to fall
      // back to Checkout (Stripe.js blocked/slow) would silently become a
      // normal paid subscription instead.
      subscription_data: startTrial
        ? { trial_end: trialEndFromSignup() }
        : { billing_cycle_anchor: nextBillingCycleAnchorUnix(), proration_behavior: "create_prorations" },
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
 * $0 first invoice (setup-intent) path below doubles as the trial path — a
 * subscription with a future trial_end has nothing to charge immediately
 * either, for the same underlying Stripe reason, so no new code path was
 * needed for trials beyond passing trial_end through.
 *
 * No card is required to START a trial (startTrial: true) — Stripe still
 * attaches a pending_setup_intent to optionally save a card for when the
 * trial converts, but the client is free to skip that step (see
 * SubscribeForm's setup-mode handling in subscribe-modal.tsx) and add a
 * card later from Suscripción settings before the trial ends. This was an
 * open call in workflows/subscription-billing.md — chosen for lower-
 * friction signup; if the trial ends with no card on file, Stripe's normal
 * attempted-charge-fails behavior applies (subscription_status moves away
 * from 'trialing', same as any other failed-payment case webhook-sync
 * already handles).
 */
export const createSubscriptionIntent = authedAction(
  async (session, startTrial: boolean = false): Promise<SubscriptionIntentResult> => {
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
      // Calendar-aligned billing (workflows/subscription-billing.md): every
      // clinic bills on the 1st, not on a per-signup-date anniversary.
      //
      // Non-trial path: billing_cycle_anchor pins the first (prorated)
      // charge's cycle to the next 1st explicitly.
      //
      // Trial path: trial_end ITSELF already resolves to a 1st-of-month date
      // (see trialEndFromSignup) and is far later than the next calendar
      // 1st, so billing_cycle_anchor is deliberately OMITTED here — passing
      // both would conflict (two different target dates). Stripe anchors
      // post-trial recurring billing to trial_end automatically once the
      // trial converts, which already lands on the 1st, so alignment holds
      // without an explicit anchor param in this branch.
      ...(startTrial
        ? { trial_end: trialEndFromSignup() }
        : { billing_cycle_anchor: nextBillingCycleAnchorUnix(), proration_behavior: "create_prorations" as const }),
      expand: ["latest_invoice", "pending_setup_intent"],
    });

    // Persist the subscription id right away — there's no Checkout Session
    // completion event to hang this on in this flow, unlike the old
    // createCheckoutSession path (see the trade-off note above).
    await supabase
      .from("kalendar_businesses")
      .update({ stripe_subscription_id: subscription.id })
      .eq("id", business.id);

    // ROOT CAUSE CONFIRMED (2026-07-29, via manual Stripe API testing — see
    // MODULES.md): invoice.confirmation_secret is NOT returned by default,
    // even on a direct stripe.invoices.retrieve() call — it must be
    // explicitly requested via expand: ["confirmation_secret"]. Without it,
    // the field is simply absent from the response (not null — genuinely
    // missing), which is what caused every previous attempt at this to fail.
    // Confirmed pending_setup_intent is genuinely null for a normal non-zero
    // invoice with no existing default payment method — the earlier theory
    // that Stripe routes through a SetupIntent-first flow in that case was
    // wrong; that was a misread of a different, now-explained symptom.
    const invoiceRef = subscription.latest_invoice;
    const invoiceId = invoiceRef
      ? typeof invoiceRef === "string"
        ? invoiceRef
        : invoiceRef.id
      : null;

    const invoice = invoiceId
      ? await stripe.invoices.retrieve(invoiceId, {
          expand: ["confirmation_secret"],
        })
      : null;
    const confirmationSecret = invoice?.confirmation_secret ?? null;

    if (confirmationSecret?.client_secret) {
      return {
        ok: true,
        clientSecret: confirmationSecret.client_secret,
        mode: "payment",
        amountDue: pricing.price,
      };
    }

    // Fallback: genuinely $0 first invoice (a 100%-off discount phase) has
    // nothing to confirm a payment for — Stripe attaches a
    // pending_setup_intent instead purely to collect+save a card for later.
    // client_secret is omitted from the nested object on subscription.pending_setup_intent
    // the same way confirmation_secret was above, so this still needs a
    // direct retrieve by id.
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
          amountDue: 0,
        };
      }
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

// ── Trial extension (not yet wired to any UI) ───────────────────────────────

export type ExtendTrialResult =
  | { ok: true; newTrialEnd: number }
  | { ok: false; error: string };

/**
 * Extends (or shortens) a business's active trial to a new end date, for
 * Arun's "auto-extension for certain clients" case (workflows/subscription-
 * billing.md's trial-period-mechanism). Deliberately NOT an authedAction —
 * a clinic owner must never be able to extend their own trial, so this
 * takes businessId directly rather than scoping to the caller's session.
 *
 * NOT YET WIRED to any UI in this repo — intended to be called from a
 * future admin "Suscripciones" tool (tracked as subscriptions-lookup-tool
 * in the admin portal's workflows/admin-portal-tools.md, which lives in the
 * separate stanize/kaminolabs-kalendar-admin repo/session). This function
 * is the reusable mechanism that tool would call; building the actual admin
 * trigger/UI is a separate piece of work.
 *
 * newTrialEnd should itself be a 1st-of-month date for the same calendar-
 * alignment reason as trialEndFromSignup, but this function doesn't enforce
 * that — whoever calls it (the future admin tool) is responsible for
 * picking a sensible date, since "extend for certain clients" is a manual/
 * judgment call per business, not a formula like the initial 3-month grant.
 */
export async function extendTrial(
  businessId: string,
  newTrialEnd: Date
): Promise<ExtendTrialResult> {
  if (!isStripeConfigured()) {
    return { ok: false, error: "La facturación no está disponible en este momento." };
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return { ok: false, error: "La facturación no está disponible en este momento." };
  }

  const supabase = await createClient();
  const { data: bizRow } = await supabase
    .from("kalendar_businesses")
    .select("stripe_subscription_id")
    .eq("id", businessId)
    .maybeSingle();

  if (!bizRow?.stripe_subscription_id) {
    return { ok: false, error: "Este negocio no tiene una suscripción." };
  }

  const newTrialEndUnix = Math.floor(newTrialEnd.getTime() / 1000);

  try {
    const updated = await stripe.subscriptions.update(bizRow.stripe_subscription_id, {
      trial_end: newTrialEndUnix,
      // A trial extension shouldn't generate a proration invoice — nothing
      // was charged during the trial, so there's nothing to prorate.
      proration_behavior: "none",
    });
    return { ok: true, newTrialEnd: updated.trial_end ?? newTrialEndUnix };
  } catch {
    return { ok: false, error: "No se pudo extender la prueba." };
  }
}
