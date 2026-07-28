# Feature Spec: Stripe Subscription Billing

**Project:** Kalendar by KaminoLabs
**Repo:** `stanize/kaminolabs-kalendar` (branch `main`)
**Priority:** #1 backlog item per `docs/reviews/2026-07-26-review.md` — no path currently exists from "clinic uses the product" to "clinic pays for the product."

**Status:** Built (commit `fd3bb57`, 2026-07-28). See amendment below for a bug found during first live test.

---

## Amendment (2026-07-28): missing `customer.subscription.created` handler

**Symptom:** First live test-mode subscription completed payment successfully
(Checkout succeeded, card charged in test mode), but `/panel/payments`
continued to show "Sin suscripción activa" indefinitely.

**Root cause:** Stripe fires `customer.subscription.created` — not
`customer.subscription.updated` — when a subscription is first created via
Checkout. The original v1 event list below (section 7) only listed
`customer.subscription.updated`, so the webhook handler had no case for
`.created` and silently ignored it (fell through to the `default` no-op
branch). `checkout.session.completed` and `invoice.payment_succeeded` both
arrived and processed correctly — only the subscription-status sync was
missing, leaving `kalendar_businesses.subscription_status` stuck at its
default `'incomplete'` even though `stripe_customer_id`/
`stripe_subscription_id` were correctly captured.

**Fix:** `app/api/webhooks/stripe/route.ts` now handles
`customer.subscription.created` with the exact same logic as
`customer.subscription.updated` (same `syncSubscriptionStatus()` call) — both
cases fall through to shared handling.

**Action required in the Stripe dashboard:** the webhook endpoint's
configured event list must include `customer.subscription.created` in
addition to the events in section 7 below, or Stripe won't send it at all
regardless of the code fix.

**One-time manual fix needed** for any business stuck in this state from
before the code fix landed — see the reconciliation note: the daily
`stripe-reconcile` cron (section 7) would eventually catch and log this
specific mismatch, but does not auto-correct it. A one-off `execute_sql`
correction (reading the true status from Stripe and writing it directly) is
the fastest fix for rows created before this amendment.

---

## 1. Goals

- Clinics pay a **flat monthly SaaS subscription** via **Stripe Checkout** (Stripe-hosted payment page — no embedded card form, no custom PCI scope).
- Stripe is the source of truth for *payment/subscription lifecycle state* (active, past_due, cancelled). Stripe is **not** the source of truth for *price* — the amount charged is always the value computed by the existing pricing engine (`currentPrice()` in the pricing/discounts spec), passed to Stripe as a final number at Checkout Session creation time. Stripe never sees discount percentages, phase schedules, or coupons.
- Subscription state changes reach the app via **webhooks** (real-time), with a **daily reconciliation cron as a backup safety net**, not the primary mechanism.
- Trial and grace-period *logic and duration* are being designed separately by Arun as an extension to `docs/specs/pricing-and-discounts-spec.md`. This spec defines the payment/webhook plumbing that trial and grace-period logic will sit on top of — it does not itself define trial length or grace-period duration.
- Manual, admin-triggered clinic shutdown (full profile takedown after non-renewal) is out of scope for this spec.

## 2. Non-goals (explicit)

- No embedded Stripe Elements / custom card form.
- No in-booking / patient-facing payments (deposits) — subscription billing only.
- No Stripe Coupons or Stripe-side discount objects — discounts are computed entirely in-house and only the final price crosses to Stripe.
- No automatic clinic profile shutdown on non-payment — separate, manual admin-portal feature to be built later.
- No multi-currency — EUR only.
- Does not itself define trial length or grace period duration.

## 3. Data model changes (built)

Stripe-linkage columns on `kalendar_businesses`: `stripe_customer_id`, `stripe_subscription_id`, `subscription_status` (mirrors Stripe's status strings 1:1), `subscription_current_period_end`.

New table `kalendar_stripe_webhook_events` for webhook idempotency (event ID as primary key).

## 4. Checkout flow

1. Clinic clicks "Subscribe" in `/panel/payments`.
2. Server action creates a Stripe Checkout Session (`mode: 'subscription'`), reusing `stripe_customer_id` if one already exists on the business row.
3. `client_reference_id` = `kalendar_businesses.id`, so the webhook handler can match the resulting subscription back to the correct business.
4. Redirect to Checkout. Stripe handles 3DS/SCA.
5. Redirect back to `success_url`. **Arrival at `success_url` is not proof of a successful subscription** — the webhook is the source of truth. The billing page polls/refreshes rather than trusting the query param.

### 4a. Dynamic per-clinic price via `price_data`

Since price is computed per-business per-month via the pricing engine, the
Checkout line item uses inline `price_data` rather than a pre-created Stripe
Price object — keeps Stripe price-agnostic, in-house engine stays the sole
source of pricing truth.

**Known coordination gap (not yet built):** because price is computed fresh
at Checkout-session-creation time (not locked in per renewal), a subscription
that lives across a discount-phase boundary keeps renewing at the price that
was active when the Checkout session was created, unless the phase-boundary
cron (`pricing-and-discounts-spec.md` section 5) is extended to also push a
price update to the live Stripe subscription. Currently that cron only sends
a notification email — it does not call `stripe.subscriptions.update()`.

## 5. Stripe → app object mapping

| Stripe concept | Kalendar mapping |
|---|---|
| Customer | One per business, `stripe_customer_id` |
| Subscription | One per business, `stripe_subscription_id` |
| Subscription status | Mirrored 1:1 into `subscription_status` |
| Price / Product | Not persisted — computed inline per Checkout session |
| Invoice | Not stored locally — link out to Stripe's Customer Portal |

## 6. What Stripe handles automatically

PCI compliance, card storage, 3DS/SCA, automatic retry/dunning on failed
renewals (Stripe Smart Retries). Grace-period logic (being designed
separately) should account for Stripe's own retry window rather than
duplicating it.

## 7. Webhooks

**Route:** `app/api/webhooks/stripe/route.ts`.

- **Signature verification** on every request using the raw body + `STRIPE_WEBHOOK_SECRET`.
- **Idempotency** via `kalendar_stripe_webhook_events`: checked before processing, inserted only after success.
- **Events handled (v1, corrected per amendment above):**
  - `checkout.session.completed` — capture `stripe_customer_id`/`stripe_subscription_id` via `client_reference_id`.
  - `customer.subscription.created` — **added in the 2026-07-28 amendment.** Fires on initial subscription creation; without this, `subscription_status` never leaves `'incomplete'`.
  - `customer.subscription.updated` — sync `subscription_status` + `subscription_current_period_end`.
  - `customer.subscription.deleted` — set `subscription_status = 'cancelled'`.
  - `invoice.payment_failed` — sync to `past_due` (defensive, in case ordering vs. `.updated` isn't guaranteed).
  - `invoice.payment_succeeded` — logged for visibility only.
- **Always respond 200** once durably recorded as processed.

**Daily reconciliation cron** (`app/api/cron/stripe-reconcile/route.ts`, backup only): compares stored `subscription_status` against Stripe's live status for every business with a `stripe_subscription_id`; logs mismatches, does not auto-correct.

**Important — Stripe dashboard event selection:** the webhook endpoint in the Stripe dashboard must have all six events above explicitly selected, or Stripe won't send events it isn't configured to send regardless of what the code handles.

## 8. Billing management for the clinic

Stripe's hosted Customer Portal (`stripe.billingPortal.sessions.create`) — no custom "update card"/"cancel" UI built for v1.

## 9. Environment variables

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Gracefully degraded/logged if unset, same convention as `RESEND_API_KEY`.

## 10. Test mode

Build and test entirely against Stripe **test mode** before touching live keys.

## 11. Testing / verification checklist

- [x] Complete a test-mode Checkout end-to-end — done 2026-07-28, surfaced the `.created` gap (see amendment).
- [ ] Re-verify full loop now that `.created` is handled and the Stripe dashboard event list is updated.
- [ ] Manually resend a webhook event twice; confirm no duplicate processing.
- [ ] Trigger a test-mode payment failure; confirm `past_due`.
- [ ] Cancel a test subscription via the Customer Portal; confirm `cancelled`.
- [ ] Confirm `client_reference_id` round-trips for both first-time and resubscribing clinics.
