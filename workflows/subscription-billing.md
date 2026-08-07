# Workflow: Subscription Billing

Stripe-backed SaaS subscription lifecycle for a clinic business, and the app-side gating that should depend on it.

## Step: subscribe
Status: done
Criteria:
- subscribe-modal.tsx collects payment via Stripe Elements (PaymentElement) in-app
- createSubscriptionIntent creates Stripe customer + subscription (default_incomplete)
- Falls back to createCheckoutSession (hosted Checkout) on Stripe.js load timeout (8s, STRIPE_LOAD_TIMEOUT_MS)
- Subscription UI lives at /panel/settings (Suscripción tab)

## Step: webhook-sync
Status: done
Criteria:
- Webhook route handles customer.subscription.created (not just .updated)
- Webhook route handles customer.subscription.updated
- Idempotency enforced via kalendar_stripe_webhook_events (checked before processing, inserted after success)
- subscription_status column on kalendar_businesses reflects live Stripe state after successful payment

## Step: reconciliation
Status: done
Criteria:
- Daily stripe-reconcile cron job exists
- Reconciliation logs mismatches rather than silently auto-correcting them

## Step: payment-method-update
Status: done
Criteria:
- payment-method-modal.tsx lets a clinic update their card via Stripe Elements
- Falls back to createBillingPortalSession on Stripe.js load timeout
- setDefaultPaymentMethod action wires the new method as default

## Step: cancel-resume
Status: done
Criteria:
- cancelSubscription performs a soft cancel (cancel_at_period_end), not immediate cancellation
- resumeSubscription reverses a pending cancellation before period end
- UI reflects cancelAtPeriodEnd / currentPeriodEnd fetched live from Stripe

## Step: pricing-phase-transitions
Status: in_progress
Criteria:
- Discount schedule (kalendar_discount_schedule_templates/phases) drives a locked-in price per subscription
- pricing-phase-notify cron emails a notification on a boundary crossing
- Boundary crossing also pushes an updated price to the live Stripe subscription (stripe.subscriptions.update) — known gap, not yet built

## Step: feature-gating
Status: not_started
Criteria:
- Panel features check subscription_status before allowing key actions
- Non-active subscriptions (incomplete, canceled, past_due) are visibly restricted in the UI
- Admin "Suscripciones" tool exists for support staff to look up/cancel stray subscriptions per-business

## Notes / Deviations
(freeform — anything found in code that doesn't map to a defined step)
