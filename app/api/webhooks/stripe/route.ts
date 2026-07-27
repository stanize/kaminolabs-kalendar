import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/billing/stripe";

/**
 * Stripe webhook receiver. See docs/specs/stripe-subscription-billing-spec.md
 * section 7.
 *
 * - Signature verification uses the RAW request body — proxy.ts does not
 *   parse bodies (it only inspects the session cookie), so this route
 *   receives the untouched payload as required.
 * - Idempotency: the incoming event's id (evt_...) is checked against
 *   kalendar_stripe_webhook_events BEFORE processing; if already present,
 *   return 200 immediately. The id is inserted AFTER successful processing —
 *   same "write after success" pattern already established for reminder
 *   idempotency (see lib/actions send-reminders cron).
 * - Always respond 200 once the event is durably recorded as processed, even
 *   if a downstream step has a non-fatal issue — Stripe retries on non-2xx,
 *   which is desirable for real delivery failures but wasteful for events
 *   we've already durably handled.
 */
export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    console.error("[stripe-webhook] Stripe not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createClient();

  // Idempotency check — return early if we've already processed this event.
  const { data: existing } = await supabase
    .from("kalendar_stripe_webhook_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const businessId = checkoutSession.client_reference_id;
        if (businessId) {
          await supabase
            .from("kalendar_businesses")
            .update({
              stripe_customer_id:
                typeof checkoutSession.customer === "string"
                  ? checkoutSession.customer
                  : (checkoutSession.customer?.id ?? null),
              stripe_subscription_id:
                typeof checkoutSession.subscription === "string"
                  ? checkoutSession.subscription
                  : (checkoutSession.subscription?.id ?? null),
            })
            .eq("id", businessId);
        } else {
          console.error("[stripe-webhook] checkout.session.completed missing client_reference_id");
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionStatus(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await supabase
          .from("kalendar_businesses")
          .update({ subscription_status: "cancelled" })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = extractSubscriptionId(invoice);
        if (subscriptionId) {
          // A customer.subscription.updated event usually accompanies this,
          // but ordering isn't guaranteed — handle both defensively.
          await supabase
            .from("kalendar_businesses")
            .update({ subscription_status: "past_due" })
            .eq("stripe_subscription_id", subscriptionId)
            .neq("subscription_status", "cancelled");
        }
        break;
      }

      case "invoice.payment_succeeded": {
        // Logged for visibility/confirmation of renewal; status sync itself
        // is driven by customer.subscription.updated, not required here.
        console.log("[stripe-webhook] invoice.payment_succeeded", event.id);
        break;
      }

      default:
        // Unhandled event types are acknowledged, not errors.
        break;
    }

    // Record as processed AFTER successful handling.
    await supabase.from("kalendar_stripe_webhook_events").insert({
      id: event.id,
      type: event.type,
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe-webhook] processing error:", event.type, err);
    // Not marked as processed — Stripe will retry, and the idempotency check
    // above will correctly treat the retry as a fresh attempt.
    return NextResponse.json({ error: "Processing error" }, { status: 500 });
  }
}

async function syncSubscriptionStatus(subscription: Stripe.Subscription) {
  const supabase = await createClient();
  const periodEnd = extractCurrentPeriodEnd(subscription);
  await supabase
    .from("kalendar_businesses")
    .update({
      subscription_status: subscription.status,
      subscription_current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    })
    .eq("stripe_subscription_id", subscription.id);
}

/**
 * current_period_end lives on each subscription item, not on the top-level
 * Subscription object, as of the 2025-08-27.basil API version this SDK is
 * pinned to. Read from the first item — Kalendar subscriptions only ever
 * have one line item (see lib/actions/billing.ts).
 */
function extractCurrentPeriodEnd(subscription: Stripe.Subscription): number | null {
  return subscription.items?.data?.[0]?.current_period_end ?? null;
}

function extractSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}
