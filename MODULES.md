# Kalendar — Module Map

Purpose: let a Claude session scope to ONE module instead of reading the whole repo.
Usage: tell Claude "we're working on module `<name>`" — Claude reads this file, then
only the files listed for that module (plus anything under "Shared infra" that the
module depends on).

This file is a map, not a refactor. Next.js file-system routing means route files
physically stay where the framework requires; module boundaries here are logical/
documented, not folder-enforced.

Keep this file honest by running `RESYNC.md` periodically (see that file) — ideally
after every feature is shipped and tested, before starting the next one.

---

## Module: auth
Login, sign-up, password reset, session handling, role assignment.

- Routes: `app/api/auth/[...all]/route.ts`, `app/signin/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`
- Components: `components/auth/login-form.tsx`, `components/auth/signup-form.tsx`, `components/auth/patient-login-form.tsx`, `components/auth/forgot-password-form.tsx`, `components/auth/reset-password-form.tsx`
- Lib: `lib/auth.ts`, `lib/auth-client.ts`, `lib/auth-session.ts`, `lib/auth-action.ts`, `lib/roles/*`
- Proxy/middleware: `proxy.ts`
- DB tables: `user`, `session`, `account`, `verification` (Better Auth, in `schema_better_auth_001.sql`), `user_roles` (in `schema_001.sql`)
- Depends on shared infra: i18n (`public.ts` dictionary), email (`lib/email.ts` — verification + reset-password emails)
- Gotchas: `lib/auth-action.ts` must stay free of `"use server"`. `schema_better_auth_001.sql` must run before `schema_001.sql` (no longer via `npx @better-auth/cli migrate`). `requireEmailVerification: false` — verification gate is UI-side (see panel-shell). Password reset: `authClient.requestPasswordReset({ email, redirectTo })` → Better Auth emails a link to its own `/api/auth/reset-password/:token` route, which 302s the browser to `redirectTo` (`/reset-password`) with `?token=...` (or `?error=INVALID_TOKEN`) — the app never builds that link itself, only renders whatever Better Auth hands `sendResetPassword` in `lib/auth.ts`. Token expires in 1h (`resetPasswordTokenExpiresIn`); resetting revokes all other sessions (`revokeSessionsOnPasswordReset: true`). Shared by clinic (`/signin`) and patient (`/patient/login`) accounts — same `emailAndPassword` config, patient flow just carries `?from=patient&redirectTo=...` through so `/reset-password` sends the user back to the right place (see `patient-portal`).

---

## Module: public-booking
The public-facing booking wizard clients use to book an appointment.

- Routes: `app/bookings/[slug]/page.tsx`, `app/bookings/confirm/[token]/page.tsx`, `app/bookings/cancel/[token]/page.tsx`
- Components: `components/booking/booking-page-shell.tsx`, `components/booking/booking-wizard.tsx`, `components/booking/cancel-booking-button.tsx`
- Lib: `lib/booking/data.ts`, `lib/booking/slots.ts`, `lib/business/booking-url.ts` (shared — see below)
- Actions: `lib/actions/booking.ts`
- DB tables: `kalendar_bookings` (write path), reads `kalendar_businesses`, `kalendar_services`, `kalendar_team_members`, `kalendar_business_hours`
- i18n: `lib/i18n/dictionaries/booking-page.ts`, `booking-result.ts`
- Depends on shared infra: email (`lib/email.ts` — confirm/cancel/owner-notify emails), auth (patient login step inside wizard)
- Gotchas: `lib/business/booking-url.ts` is SHARED with panel-business (booking link display) — changes here affect both. Timezone hardcoded `Europe/Madrid` in `lib/booking/slots.ts`. `ConfirmAuthModal` inside `booking-wizard.tsx` is a SEPARATE, self-contained login/register implementation — it does NOT use `components/auth/patient-login-form.tsx`, so any change to the shared patient login (e.g. forgot-password link, error copy) must be mirrored here by hand. Its forgot-password link does a hard `window.location.href` nav (not a soft `<Link>`) to `/forgot-password?from=patient&redirectTo=<current booking page path>` — computed inside the click handler, not render body, since this is SSR'd and `window` isn't available server-side.

---

## Module: patient-portal ⚠️ WORK IN PROGRESS
Patient-facing account area (separate from the clinic panel). **Still actively
changing** — a new component (`components/auth/patient-auth-card.tsx`) has
appeared since the last resync and hasn't been reviewed/documented yet. Don't
treat this module's file list as complete; do a proper resync pass on it once
it stabilizes rather than trying to keep it current turn-by-turn.

- Routes: `app/patient/(protected)/page.tsx`, `app/patient/(protected)/layout.tsx`, `app/patient/(protected)/bookings/page.tsx`, `app/patient/login/page.tsx`
- Components: `components/auth/patient-login-form.tsx`, `components/auth/patient-auth-card.tsx` (new, role/purpose not yet reviewed)
- Lib: `lib/booking/patient-data.ts`
- Actions: `lib/actions/patient.ts`
- DB tables: `kalendar_patients`, reads `kalendar_bookings`
- Depends on shared infra: auth (Google OAuth self-heal in `app/patient/layout.tsx`; password reset reuses `auth`'s `/forgot-password` and `/reset-password` pages with `?from=patient&redirectTo=...` — same account/table, just carries context back to `/patient/login` instead of `/signin`), i18n
- Gotchas: `provisionPatient` assigns patient role AND upserts `kalendar_patients` — don't split these without checking both call sites.

---

## Module: panel-shell
Panel-wide chrome: sidebar, layout, home checklist, support form. Not a single
feature — this is the "frame" all panel-* modules render inside.

- Routes: `app/panel/layout.tsx`, `app/panel/page.tsx`, `app/panel/support/page.tsx`
- Components: `components/panel/sidebar.tsx`, `components/panel/email-verification-gate.tsx`, `components/panel/setup-complete-banner.tsx`, `components/panel/editable-greeting-name.tsx`, `components/panel/booking-page-card.tsx`
- Actions: `lib/actions/support.ts`, `lib/actions/account.ts`
- Data: `lib/account/data.ts` (getPreferredName)
- DB tables: `kalendar_support_tickets`, `kalendar_user_preferences`
- i18n: `lib/i18n/dictionaries/panel-shell.ts`
- Cross-module: Inicio (`app/panel/page.tsx`) reuses `panel-calendar`'s `TodayStatsWidget` and `WeekStatsWidget` components and its `calendar.ts` i18n dict slice, plus `booking-page-card.tsx` (below) for the booking-link card — this module isn't fully self-contained for its home page.
- Gotchas: clinic role assignment happens idempotently on every panel visit (in the layout) — self-heals Google OAuth + schema resets. BUT the layout first checks `getUserRoles`: a user holding `patient` and NOT `clinic` is redirected to `/patient` instead of being auto-granted `clinic` — role is sticky from first sign-up, so a patient-only account never gets promoted just by landing on `/panel` (e.g. via the clinic `/login` form or a Google OAuth callback, both of which always target `/panel`). Dual-role accounts (both `patient` and `clinic`) are a future feature, not yet handled — currently they always land in the panel. Support screenshot upload goes to Supabase Storage bucket `support-attachments`. Home greeting shows an editable "preferred name" (`kalendar_user_preferences.preferred_name`), a soft display name distinct from the account's Better Auth `user.name` — falls back to the account name's first word, then to a plain "Inicio"/"Home" fallback with no prefix.

---

## Module: panel-business
"Negocio" — the business record (name, type, legal ID, address, contact, slug).

- Routes: `app/panel/business/page.tsx`
- Components: `components/panel/business-form.tsx`
- Lib: `lib/business/data.ts`, `lib/business/reserved-slugs.ts`, `lib/business/slug-screen.ts`, `lib/business/booking-url.ts` (shared — see public-booking), `lib/business/postal-codes.ts` + `postal-codes-es.json` (static ~11k-entry Spanish postal-code → city/province dataset, free, no external API), `lib/business/phone-country-codes.ts` (static curated dialing-code list, Spanish labels, defaults to +34)
- Actions: `lib/actions/business.ts` (includes `lookupPostalCode`, a thin authed wrapper around the static dataset)
- DB tables: `kalendar_businesses`
- i18n: `lib/i18n/dictionaries/business.ts`, `business-types.ts`
- Gotchas: slug is PERMANENT after creation — form shows read-only on edit, `saveBusinessSettings` ignores slug on update. Slug moderation: clean slugs go `active` instantly but sit in a review queue (`slug_reviewed_at IS NULL`); flagged ones go `pending_review`. Postal-code autofill only fills city/province when BOTH are still empty (never overwrites something the user already typed); the dataset sometimes uses bilingual province names (e.g. "Araba/Álava") since the source is bilingual for some autonomous communities — fields stay fully editable. `address_country` is free text, defaults to "España" client-side for new businesses only. Phone is stored as two columns, `phone_country_code` (defaults `+34`) and `phone_number` — UI shows a country-code dropdown (`lib/business/phone-country-codes.ts`, static list) beside the number field.

---

## Module: panel-services
"Servicios" — service catalog (name, duration, price).

- Routes: `app/panel/services/page.tsx`
- Components: `components/panel/services-manager.tsx`
- Lib: `lib/services/*`
- Actions: `lib/actions/services.ts`
- DB tables: `kalendar_services`
- i18n: `lib/i18n/dictionaries/services.ts`
- Gotchas: template flow is customize-before-confirm (multi-select → staged editable drafts → bulk confirm). `ServiceFields` type shared between editor and staged drafts.

---

## Module: panel-team-availability
"Equipo" + "Disponibilidad" — staff roster and working hours. Grouped together
because they're tightly coupled (availability can be per-member in the future).

- Routes: `app/panel/team/page.tsx`, `app/panel/availability/page.tsx`
- Components: `components/panel/team-manager.tsx`, `components/panel/availability-manager.tsx`, `components/panel/availability-setup-wizard.tsx` (first-setup steps 1–2), `components/panel/time-select.tsx` (shared HH:MM dropdown)
- Lib: `lib/team/*`, `lib/availability/*`
- Actions: `lib/actions/team.ts`, `lib/actions/availability.ts`
- DB tables: `kalendar_team_members`, `kalendar_business_hours`
- i18n: `lib/i18n/dictionaries/team.ts`, `availability.ts`
- Gotchas: `team_mode` (`solo`|`team`) lives on `kalendar_businesses`, not on the team table. `ensureOwnerSeeded` idempotently inserts owner as a team member. Availability save is an atomic whole-week replace. Per-member overrides are deferred/future — don't assume they exist. First-time availability setup (`hasSavedHours === false`) runs a 3-step wizard: days → standard hours → review; the review step is the normal editor grid pre-filled by fanning the standard hours out to each selected day (defaults: Mon–Fri, 09:00–13:00/14:00–18:00 in `SETUP_DEFAULT_*`). There is deliberately NO linked-template concept — after fan-out every day is independent; the wizard is only a fast entry path and never shows again once hours are saved.

---

## Module: panel-calendar
"Calendario" — owner-facing view of upcoming/pending bookings.

- Routes: `app/panel/calendar/page.tsx`
- Components: `components/panel/calendar-bookings.tsx`, `components/panel/calendar-grid-view.tsx` (Outlook-style weekly grid, per-provider columns), `components/panel/calendar-header.tsx`, `components/panel/calendar-month-view.tsx`, `components/panel/appointment-modal.tsx` (manual appointment creation), `components/panel/today-stats-widget.tsx` (also reused by `panel-shell` — see that module's shared infra note), `components/panel/week-stats-widget.tsx` (also reused by `panel-shell`, same pattern as `today-stats-widget.tsx`)
- Lib: `lib/booking/owner-data.ts`, `lib/calendar/client-date.ts` (shared by the grid/month/bookings views)
- Actions: `lib/actions/booking-owner.ts`
- DB tables: `kalendar_bookings` (read + status updates), reads `kalendar_patients`
- i18n: `lib/i18n/dictionaries/calendar.ts`
- Gotchas: "Pendientes" tab is the guest-booking review queue — flat list (no day grouping), sorted soonest-expiry-first via `pendingExpiryAt`, with a live `CountdownBadge` (re-renders every 60s). `confirmBookingAsOwner` (in `lib/actions/booking-owner.ts`) transitions `pending_confirmation` → `confirmed`, clears the expiry window, and emails the guest a confirmation receipt in their locale — see cron module for the separate sweep that expires (rather than confirms) stale pending bookings. Reminder failure visibility: `reminder_send_failed`/`last_reminder_error` (set by the reminders cron — see shared infra) are threaded through `owner-data.ts`'s `WeekViewBooking` → `app/panel/calendar/page.tsx` mapping → `calendar-grid-view.tsx`'s `WeekBookingVM` (small amber ⚠ marker on the week chip) → `booking-detail-modal.tsx` (labeled row with the error as a tooltip). Visibility-only, no retry UI or notification system.

---

## Module: panel-settings
"Ajustes" — tabbed settings shell. First tab (Suscripción) holds the
Kalendar SaaS subscription UI (moved here from the old `/panel/payments`
route per Arun's 2026-07-29 request — `/panel/payments` is now a different,
unrelated feature, see that module below). Other tabs are placeholder scaffolding.

- Routes: `app/panel/settings/layout.tsx` (tab nav shell, guards on business existing), `app/panel/settings/page.tsx` (redirects to the subscription tab), `app/panel/settings/subscription/page.tsx`, `app/panel/settings/notifications/page.tsx` (placeholder), `app/panel/settings/security/page.tsx` (placeholder), `app/panel/settings/language/page.tsx` (placeholder)
- Components: `components/panel/settings-tabs.tsx` (tab nav), `components/panel/subscription-manager.tsx` (renamed from `payments-manager.tsx` — plan/renewal card, payment method, invoice history, cancel/resume flow; no longer renders its own page title, since the settings layout already provides one), `components/panel/payment-method-modal.tsx` (in-app card-update modal via Stripe Elements/`PaymentElement`), `components/panel/subscribe-modal.tsx` (in-app subscribe modal, same pattern — added 2026-07-29 to replace the Checkout-page redirect for new subscriptions too, after Arun asked for the update-card modal's pattern to cover the initial subscribe flow as well)
- Client deps: `@stripe/stripe-js`, `@stripe/react-stripe-js` — the app's only client-side Stripe usage; everything else is server-only.
- Lib: `lib/pricing/{types,compute,data}.ts` (pure discount/price computation, always derived on read — never cached or stored), `lib/billing/{stripe,data,stripe-data}.ts` — `stripe-data.ts` does live, read-only Stripe API reads (subscription detail, default payment method, invoice list); deliberately separate from `data.ts`'s `getBillingState()`, which reads the webhook-synced `kalendar_businesses` columns that the rest of the app gates on.
- Actions: `lib/actions/billing.ts` — `createSubscriptionIntent` (primary subscribe flow as of 2026-07-29: creates the Stripe customer + subscription directly with `payment_behavior: 'default_incomplete'`, returns either a PaymentIntent client secret ("payment" mode, normal priced first invoice) or a SetupIntent client secret ("setup" mode, $0 first invoice during a discount phase — nothing to charge yet but still collects+saves a card via Stripe's auto-attached `pending_setup_intent`) for `subscribe-modal.tsx`'s `<PaymentElement>` to confirm against — **trade-off vs the old Checkout flow: the Stripe Subscription object is created immediately when the modal opens and the action runs, even if the clinic then closes the modal without paying** (unlike an abandoned Checkout Session, which never creates a Subscription at all); Stripe auto-cancels unpaid `default_incomplete` subscriptions after 23h so this self-cleans, and the resulting state (a real `stripe_subscription_id` with `subscription_status='incomplete'`) isn't meaningfully different from today's already-existing default, so this was accepted rather than engineered around. Creates one Stripe Product per subscribe attempt (subscription items need a real Product id, unlike Checkout's inline `product_data`) — analogous sprawl to what Checkout did for us automatically before, not a regression. `createCheckoutSession` (the old Checkout-redirect flow) is kept in the file but no longer imported/used by any UI — a working fallback, not dead code to prune casually. Also: `createBillingPortalSession` (fallback link to the full hosted portal), `createSetupIntent`/`setDefaultPaymentMethod` (power `payment-method-modal.tsx`, the update-existing-card flow), `cancelSubscription`/`resumeSubscription` (soft cancel via `cancel_at_period_end`, not immediate `subscriptions.cancel()`). All Checkout/Portal `success_url`/`cancel_url`/`return_url` values (used by the surviving fallback actions) point at `/panel/settings/subscription` — if this route ever moves again, these need updating too.
- DB tables: `kalendar_businesses` (plan/discount/Stripe columns), `kalendar_plan_prices`, `kalendar_discount_schedule_templates`, `kalendar_discount_schedule_phases`, `kalendar_stripe_webhook_events`
- i18n: `lib/i18n/dictionaries/settings.ts` (shell + tab labels + generic placeholder copy, reused verbatim by the notifications/security/language tabs), `lib/i18n/dictionaries/payments.ts` (subscription tab content — name is a holdover from before the move, not yet renamed)
- Specs: `docs/specs/pricing-and-discounts-spec.md`, `docs/specs/stripe-subscription-billing-spec.md` (see its 2026-07-28 amendment)
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (new — required client-side by the payment-method modal's `loadStripe()` call; the `NEXT_PUBLIC_` prefix is a Next.js requirement to expose it to the browser bundle, this is the publishable key so that's expected/safe to expose) — gracefully degraded/logged if the server-side keys are unset, same convention as `RESEND_API_KEY` (see shared infra); the modal itself shows an error state if the publishable key is missing.
- Gotchas: Stripe is the source of truth for subscription *lifecycle state* only, never for *price* — the amount is always computed by `currentPrice()` and passed to Stripe as a `price_data` line item at Checkout-session-creation time, so a subscription that lives across a discount-phase boundary keeps renewing at its original locked-in price. `pricing-phase-notify` (daily) currently only emails a notification on a boundary crossing — it does NOT push an updated price to the live Stripe subscription; extending it to call `stripe.subscriptions.update()` at the boundary is a known, tracked gap. Webhooks are the primary sync mechanism; `stripe-reconcile` (daily) is a backup only and logs mismatches rather than silently auto-correcting them. Idempotency via `kalendar_stripe_webhook_events`: checked before processing, inserted only after success. **`customer.subscription.created` must be handled identically to `.updated`** — Stripe fires `.created`, not `.updated`, on first subscription creation; missing this left `subscription_status` stuck at `'incomplete'` after a real successful Checkout in testing (2026-07-28) — see spec amendment. Both events must also be selected in the Stripe dashboard's webhook endpoint config. This SDK is pinned to API version `2025-08-27.basil` — `current_period_end` lives on `subscription.items.data[0]`, not the top-level `Subscription` object, and an invoice's originating subscription is at `invoice.parent.subscription_details.subscription`, not a top-level `invoice.subscription` field. `subscriptionDetail.cancelAtPeriodEnd`/`currentPeriodEnd` shown on the page are fetched live from Stripe on each page load (`stripe-data.ts`), not stored in `kalendar_businesses`. No admin-portal CRUD for discount templates/phases yet. No plan-switching UI ("Adjust plan") — Kalendar only has solo/multi, fixed at signup; nothing to switch to yet. Notifications/Security/Language tabs are empty scaffolding — each `page.tsx` is a ~15-line placeholder rendering `dict.placeholder`, ready for a future module section once actually built.

- **RESOLVED (2026-07-29) — root cause of `createSubscriptionIntent` failing to produce a usable client secret.** Confirmed via manual `curl` testing directly against the Stripe API (Claude's sandbox can't reach `api.stripe.com` — not on its network egress allowlist — so Arun ran the calls and pasted results): `invoice.confirmation_secret` is **not returned by default**, even on a direct `stripe.invoices.retrieve()` call by id — it must be explicitly requested via `expand: ["confirmation_secret"]`, exactly like `payment_intent` required explicit expansion in older API versions. Without it the field is genuinely absent (not `null`) from the response. This was the actual bug the whole time; the earlier "SetupIntent-first routing" theory was a misread of this same underlying symptom — `pending_setup_intent` is genuinely `null` for a normal non-zero invoice with no existing default payment method, confirmed in the raw response. Fix: `stripe.invoices.retrieve(invoiceId, { expand: ["confirmation_secret"] })`, checked before the (now-secondary, genuinely-$0-invoice-only) `pending_setup_intent` fallback. The `subscribe-modal.tsx` → `createCheckoutSession` fallback (shipped as a stopgap) is kept in place as a safety net but should no longer be needed in the normal case.

---

## Module: panel-payments
"Pagos" (client-facing) — payments the CLINIC collects FROM its own
clients/patients (deposits, no-show charges, per-appointment payment
status). NOT the Kalendar SaaS subscription — that moved to
`panel-settings` (Suscripción tab) on 2026-07-29. Placeholder only for now.

- Routes: `app/panel/payments/page.tsx` — static placeholder card, no data fetching beyond the standard business-exists guard.
- i18n: `lib/i18n/dictionaries/client-payments.ts`
- Gotchas: `kalendar_bookings.payment_status` and the `no_show` enum value already exist in the schema (added in an earlier session, see calendar-page booking-detail-modal's Pago selector) — a future build-out of this page would likely start from querying that column rather than adding new schema. Don't confuse this module's dictionary/component names with `panel-settings`'s subscription tab; both are colloquially "payments" to Arun but are unrelated features.

---

## Shared infra (not a module — cross-cutting, used by multiple modules above)

- **i18n mechanism**: `lib/i18n/config.ts`, `lib/i18n/server.ts`, `lib/actions/locale.ts`. Cookie: `kalendar_locale`. One dictionary file per module (see each module's "i18n" line above). If a module needs new UI strings, add to its own dictionary file — don't create a new mechanism.
- **Email**: `lib/email.ts` (Resend REST API, no SDK). Used by: auth (verification), public-booking (confirm/cancel/owner-notify), future reminders/reschedule.
- **`.ics` calendar attachment**: `lib/booking/ics.ts` — consumed by both `lib/actions/booking.ts` (public-booking) and `lib/actions/booking-owner.ts` (panel-calendar); not owned by either module alone.
- **Panel save overlay**: `components/panel/save-overlay.tsx` (`SaveOverlayState`, `SUCCESS_FLASH_MS`) — shared "saving → success flash" UI state used by `panel-business`, `panel-services`, and `panel-team-availability` forms (`business-form.tsx`, `services-manager.tsx`, `team-manager.tsx`, `availability-manager.tsx`). Not module-specific; add new consumers here rather than duplicating.
- **Cron**: two jobs, different schedulers. `app/api/cron/send-reminders/route.ts` (24h/1h reminders) — primary scheduler is **Supabase `pg_cron`+`pg_net`** (job `send-appointment-reminders`, every 15 min), `.github/workflows/reminders-cron.yml` kept as manual-only fallback (`workflow_dispatch`, no schedule, safe to overlap since sending is idempotent). Touches `kalendar_bookings` (`reminder_24h_sent_at`/`reminder_1h_sent_at`/`reminder_send_failed`/`last_reminder_error`) — see `panel-calendar`'s gotchas for the failure-visibility UI. `app/api/cron/sweep-expired-bookings/route.ts` — unchanged, still GitHub Actions only (`sweep-cron.yml`). Both share the `CRON_SECRET` env var (see `CLAUDE.md`). Relevant to public-booking and panel-calendar. Full build/decision log: `docs/reminders-build-log.md`.
- **Supabase client**: `lib/supabase/*` — service-role key, used by every module for DB writes.
- **Schema**: `supabase/schema_001.sql` (all `kalendar_*` tables + `user_roles`), `supabase/schema_better_auth_001.sql` (Better Auth tables). Any module adding/changing a table edits `schema_001.sql` directly (destructive, re-run convention).
- **Onboarding leftovers**: `lib/onboarding/{data,types,slug}.ts` — larger dependency surface than the name suggests. `lib/onboarding/types.ts` exports `DayId` and `BusinessType`, which have become de facto shared types: imported by `lib/availability/{constants,data}.ts`, `lib/booking/data.ts`, `lib/booking/slots.ts`, `lib/business/data.ts`, `lib/actions/{business,availability}.ts`, and the `availability.ts`/`business-types.ts` i18n dictionaries. `lib/onboarding/data.ts` exports `SERVICE_TEMPLATES` and `BUSINESS_TYPES`, used by `app/panel/services/page.tsx`, `lib/actions/business.ts`, and `app/page.tsx`. `lib/landing/ejemplos.ts` imports `OnboardingData`. (`app/bookings/[slug]/page.tsx` does not import onboarding directly — only transitively via `lib/booking/slots.ts`.) Not a live module; don't add to it — but `DayId`/`BusinessType` are good candidates for promotion to a real shared-types location in a future cleanup pass, since half the app now depends on a folder named for a feature that no longer exists as such.

---

## Not yet modularized / doesn't exist yet

These appear in `CLAUDE.md` or memory as planned but were NOT found in the repo as of
the last resync — don't assume they exist without checking: `/panel/clients`,
`/panel/notifications`, `/panel/invoices`, `/panel/reports`,
`/panel/integrations`. When one of these gets built, add a new
module section above.

---

_Last resynced: 2026-07-26_
