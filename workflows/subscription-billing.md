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
- Billing is pay-in-advance (standard Stripe subscription behavior — a period's payment is due at that period's start, covering the period ahead)
- Three-phase non-payment policy, keyed off the unpaid billing period's own start/end (not fixed calendar dates — a clinic's cycle may not start on the 1st):
  - Phase 1 (period start to period start + 15 days, subscription_status = past_due): full access, nothing restricted. This is the grace window for a failed card to resolve itself (Stripe auto-retry, or the clinic updates their card) without the clinic or their patients noticing anything.
  - Phase 2 (period start + 15 days to period end, still unpaid): public booking page (guest-facing) stops accepting new bookings. Panel otherwise stays fully usable — clinic can still see their calendar, manage existing bookings, view everything as normal.
  - Phase 3 (past period end, still unpaid — subscription_status likely unpaid or cancelled by Stripe's own dunning by this point): full panel lockout. The only screen/action available is paying the outstanding bill (/panel/settings Suscripción tab or equivalent). The moment payment succeeds, full access reopens immediately (webhook-sync already handles the status flip back to active).
- BUILD NOTE: schema currently only stores subscription_current_period_end, not the period's start — computing "15 days into the period" needs either storing current_period_start too (mirrored from Stripe, consistent with the existing "mirror Stripe's own values" pattern), or deriving day-15 as 15 days after the previous period's end. Decide which before building.
- A single shared helper reads subscription_status + the phase computation above, rather than scattered inline status checks
- Public booking page's restriction (Phase 2/3) only affects the specific lapsed clinic's slug — unrelated clinics are entirely unaffected
- Gated panel actions (Phase 3) show a clear payment prompt, not a generic error
- Admin "Suscripciones" tool exists in the admin portal for support staff to look up/cancel stray subscriptions per-business — tracked as subscriptions-lookup-tool in admin-portal-tools.md, avoid building it twice

## Notes / Deviations
(freeform — anything found in code that doesn't map to a defined step)
