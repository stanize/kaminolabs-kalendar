# Workflow: Subscription Billing

Stripe-backed SaaS subscription lifecycle for a clinic business, and the app-side gating that should depend on it.

STRATEGIC DEFERRAL (2026-08-25): Arun has decided to go to market without the subscription model for MVP — clinics onboarding in September get 6 months free, with real live usage prioritized over billing before the product is battle-tested. Steps below marked "deferred" are explicitly out of MVP scope, not just unbuilt — do not build them as part of the current push. The already-built steps (subscribe, webhook-sync, reconciliation, payment-method-update, cancel-resume) remain done/dormant — no need to rip them out, they're just not being activated/gated yet.

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

## Step: billing-failure-banner
Status: deferred (out of MVP scope — see strategic deferral note at top)
Criteria:
- past_due state is rendered by subscription-manager.tsx — confirmed working, but ONLY visible if the owner navigates to /panel/settings (Suscripción tab) themselves
- Missing: a global banner/indicator visible from anywhere in the panel (e.g. panel home, calendar, any page under /panel) when subscription_status is past_due, so an owner isn't relying on remembering to check settings
- Banner should link directly to the Suscripción tab to resolve it
- This is the visibility half of the payment-failure story — see feature-gating below for the actual access-restriction phases (1st-14th full access / 15th-EOM booking blocked / next 1st lockout); the banner should appear starting Phase 1 (immediately on past_due), well before any restriction actually kicks in, so the clinic has maximum warning

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
Status: deferred (out of MVP scope — see strategic deferral note at top)
Criteria:
- Discount schedule (kalendar_discount_schedule_templates/phases) drives a locked-in price per subscription
- pricing-phase-notify cron emails a notification on a boundary crossing
- Boundary crossing also pushes an updated price to the live Stripe subscription (stripe.subscriptions.update) — known gap, not yet built

## Step: calendar-aligned-billing
Status: deferred (out of MVP scope — see strategic deferral note at top)
Criteria:
- DECIDED: every subscription bills on the 1st of the month, regardless of signup date — not per-clinic anniversary billing (Stripe's default). Chosen over per-client cycles for operational simplicity: one billing day, one "who's overdue" check, no per-clinic period-start tracking needed anywhere downstream (this directly simplifies feature-gating's day-15 computation below).
- Mechanism: Stripe's billing_cycle_anchor set to the 1st of the following month at subscription creation, so recurring charges land on the 1st going forward
- First (partial) period is prorated automatically by Stripe (proration_behavior) — signing up on the 15th means a prorated charge for the rest of that month, then full price from the 1st
- Direct consequence: current_period_start is always the 1st of the month for every clinic once this is live — the BUILD NOTE under feature-gating about needing to store current_period_start becomes moot; "day 15" is always literally the 15th, no per-clinic math required
- Payment-collection load is concentrated on the 1st (all active clinics charge same-day) — webhook-sync's existing idempotency check (kalendar_stripe_webhook_events, checked before processing) needs to hold up under a same-day burst rather than one-at-a-time; worth a quick load check once there are enough clinics for it to matter
- Applies to trial-period-mechanism too: trial_end (see below) should itself land on the 1st of a month, not an arbitrary date, so a converting trial rolls straight into the same aligned cycle rather than creating an off-cycle subscription

## Step: trial-period-mechanism
Status: deferred (out of MVP scope — see strategic deferral note at top)
Criteria:
- Depends on calendar-aligned-billing (trial_end should resolve to a 1st-of-month date)
- Trial approach: Stripe-native trial via trial_end as an absolute date (not trial_period_days) — a day-count doesn't map cleanly onto "free until the aligned cycle starts" the way an absolute date does. Example: sign up mid-January intending "~3 months free" -> trial_end = April 1st. Sign up January 20th -> nearest useful cutoff is either April 1st or, if a touch more runway is intended, May 1st (Arun's own example: "you get two extra weeks free" when the last free month would otherwise end mid-month) — exact rule for picking the cutoff date from a signup date is Arun's call, not yet decided
- kalendar_businesses.subscription_status already mirrors Stripe's own status strings 1:1 by design ("do not invent a parallel vocabulary" per schema comment), and trialing is already a valid CHECK value, so this is a continuation of the existing pattern, not a new one
- createSubscriptionIntent (or equivalent sign-up path) passes trial_end so a new subscription starts in trialing rather than incomplete/requiring a card upfront — decide whether a card is required at trial start or only when the trial converts
- webhook-sync already handles customer.subscription.created/.updated generically, so subscription_status transitioning trialing -> active (or -> past_due/unpaid if trial ends unconverted) should require no new webhook logic, only gating logic downstream reading the status correctly
- Panel UI shows remaining trial time somewhere visible (e.g. a banner) so a trialing clinic isn't surprised when it ends

## Step: feature-gating
Status: deferred (out of MVP scope — see strategic deferral note at top)
Criteria:
- Depends on trial-period-mechanism and calendar-aligned-billing being decided/built first (gating logic needs to treat trialing as allowed, not just active, and relies on period-start always being the 1st)
- Billing is pay-in-advance (standard Stripe subscription behavior — a period's payment is due at that period's start, covering the period ahead)
- Three-phase non-payment policy, keyed off calendar dates now that billing is aligned to the 1st (no per-clinic period-start tracking needed):
  - Phase 1 (1st–14th of the month, subscription_status = past_due): full access, nothing restricted. This is the grace window for a failed card to resolve itself (Stripe auto-retry, or the clinic updates their card) without the clinic or their patients noticing anything.
  - Phase 2 (15th to end of month, still unpaid): public booking page (guest-facing) stops accepting new bookings. Panel otherwise stays fully usable — clinic can still see their calendar, manage existing bookings, view everything as normal.
  - Phase 3 (1st of the next month, still unpaid — subscription_status likely unpaid or cancelled by Stripe's own dunning by this point): full panel lockout. The only screen/action available is paying the outstanding bill (/panel/settings Suscripción tab or equivalent). The moment payment succeeds, full access reopens immediately (webhook-sync already handles the status flip back to active).
- A single shared helper reads subscription_status + today's date against the phase boundaries above, rather than scattered inline status checks
- Public booking page's restriction (Phase 2/3) only affects the specific lapsed clinic's slug — unrelated clinics are entirely unaffected
- Gated panel actions (Phase 3) show a clear payment prompt, not a generic error
- Admin "Suscripciones" tool exists in the admin portal for support staff to look up/cancel stray subscriptions per-business — tracked as subscriptions-lookup-tool in admin-portal-tools.md, avoid building it twice

## Notes / Deviations
(freeform — anything found in code that doesn't map to a defined step)
