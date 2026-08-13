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

## Step: trial-period-mechanism
Status: not_started
Criteria:
- Trial approach: Stripe-native trial (trial_period_days on subscription creation), not an app-side trial_ends_at flag — kalendar_businesses.subscription_status already mirrors Stripe's own status strings 1:1 by design ("do not invent a parallel vocabulary" per schema comment), and trialing is already a valid value in the CHECK constraint, so this is a continuation of the existing pattern rather than a new one
- createSubscriptionIntent (or equivalent sign-up path) passes trial_period_days so a new subscription starts in trialing rather than incomplete/requiring a card upfront — decide whether a card is required at trial start or only when the trial converts
- Trial length decided (e.g. 14 days — TBD, business decision not yet made)
- webhook-sync already handles customer.subscription.created/.updated generically, so subscription_status transitioning trialing -> active (or -> past_due/cancelled if no card / trial ends unconverted) should require no new webhook logic, only gating logic downstream reading the status correctly
- Panel UI shows remaining trial time somewhere visible (e.g. a banner) so a trialing clinic isn't surprised when it ends

## Step: feature-gating
Status: not_started
Criteria:
- Depends on trial-period-mechanism being decided first (gating logic needs to treat trialing as allowed, not just active)
- A single shared helper (e.g. hasActiveAccess(business) checking subscription_status in ('trialing', 'active')) is used everywhere gating is needed, rather than scattered inline status checks
- Scope of what's gated: booking creation/editing (manual + guest wizard reachable via the public page), calendar actions, and settings changes are blocked for a non-trialing/non-active business — viewing existing data (calendar, past bookings) stays available so a lapsed clinic isn't locked out of their own records, only from taking new actions
- past_due gets a distinct, softer treatment than cancelled/unpaid/incomplete — e.g. a warning banner with a grace period rather than immediate hard block, since past_due often resolves itself (Stripe retries) — exact grace period TBD
- Gated actions show a clear, specific upgrade/reactivate prompt (not a generic error) linking to /panel/settings' Suscripción tab
- Public booking page (guest-facing) is NOT gated by the clinic's subscription status — a guest should still be able to book with a clinic mid-lapse; gating applies to the clinic's own panel actions only (open question: confirm this is actually the intended behavior, since a lapsed clinic still taking new bookings they can't manage may not be desired either)
- Admin "Suscripciones" tool exists in the admin portal for support staff to look up/cancel stray subscriptions per-business — this is an admin-portal-tools.md concern by file organization, but listed here too since it's part of the same gating story; avoid building it twice

## Notes / Deviations
(freeform — anything found in code that doesn't map to a defined step)
