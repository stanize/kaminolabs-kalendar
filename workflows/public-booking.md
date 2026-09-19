# Workflow: Public Booking

The guest-facing flow for booking, confirming, and cancelling an appointment via the public wizard.

## Step: wizard-service-provider-time
Status: done
Criteria:
- Wizard exists at app/bookings/[slug]/page.tsx (components/booking/booking-wizard.tsx)
- Step 1: service selection
- Step 2: provider selection
- Step 3: date/time selection backed by slot engine (lib/booking/slots.ts)
- Double-booking prevented via partial unique index in schema
- Service list shows price inline per option (priceLabel helper, e.g. "52 min · 52 €") — already matches the reference service's price-in-list pattern

## Step: visible-progress-indicator
Status: in_progress
Criteria:
- PENDING TESTING (2026-09-18, verified against code): fully implemented —
  WizardProgress component (components/booking/booking-wizard.tsx:833-869),
  dot markers + connecting line, brand-colored for completed steps,
  current step highlighted via a ring. Comment block above it (lines
  816-832) explicitly documents it as this exact step's build. Not yet
  exercised in a running app, so `in_progress` not `done`.
- A visible step-progress bar is rendered at the top of the wizard (numbered circles connected by a line, current step highlighted, e.g. "① Servicio → ② Fecha/Hora → ③ Detalles → ④ Confirmación") — inspired by a reference service (clinic-cloud.com)'s "Tratamientos / Calendario / Solicitud / Reserva" indicator
- Internal step state already exists (booking-wizard.tsx's Step type: service | provider | date | done) — this is a UI addition on top of existing state, not a new state machine
- Step labels adapt correctly whether the business is solo (3 visible steps: service, date, confirm) or team (4 visible steps: service, provider, date, confirm) — matches the existing conditional skip of the provider step for solo businesses
- Works on mobile widths without wrapping awkwardly (this is a phone-first booking flow)

## Step: appointment-summary-recap
Status: in_progress
Criteria:
- PENDING TESTING (2026-09-18, verified against code): fully implemented —
  AppointmentRecap component (booking-wizard.tsx:757-776), rendered inside
  ConfirmAuthModal for all non-authenticated views (`{!patient &&
  <AppointmentRecap .../>}`), with a richer merged detail list for the
  already-authenticated branch. Matches the criteria below. Not yet
  exercised in a running app, so `in_progress` not `done`.
- Once a service + provider (if team) + slot are chosen, a summary recap ("Resumen Cita" style — service name, price, provider if applicable, date/time) is shown at the top of the final details-collection step, before the guest fills in their contact info — inspired by the same reference service, which shows this directly above the "Usuario no registrado / Usuario registrado" contact form
- Recap stays visible through the auth-gate step too (ConfirmAuthModal), not just the guest-details form, so a returning/registering user also sees what they're confirming
- Purely a display addition — doesn't change submission logic, booking.ts's actual submit path is unaffected

## Step: auth-gate
Status: done
Criteria:
- Guest vs authenticated paths both supported
- ConfirmAuthModal (self-contained, separate from components/auth/patient-login-form.tsx) handles login/register inline
- Forgot-password link from wizard carries ?from=patient&redirectTo=<booking page path>

## Step: details-and-confirmation
Status: done
Criteria:
- Final step captures booking details and submits via lib/actions/booking.ts
- Booking written to kalendar_bookings
- Guest receives confirmation email in their locale (guest_locale) subject to EMAIL_LOCALE pin
- Owner receives new-booking notification email

## Step: guest-immediate-confirm-with-clinic-followup
Status: done
Criteria:
- DECISION: Arun decided to drop the 24h guest auto-expiry system entirely.
  A guest booking is `confirmed` immediately on submit if the slot is
  available — same as an authenticated/verified patient booking. No more
  `pending_confirmation` status for guests, no more `pending_expiry_at`
  deadline, no more confirm-by-email-token flow.
- Rationale (Arun): auto-cancelling a guest's appointment because they
  didn't click an email link within 24h was causing lost bookings for no
  real benefit — better to hold the slot and let the clinic proactively
  reach out to unfamiliar guests to reduce no-shows, rather than silently
  killing the reservation.
- EXTENDED (same day, follow-up commit 6d13019, "a patient's first
  (unverified) booking also confirms immediately"): the original build
  (commit 159c05a) still special-cased an authenticated-but-unverified
  patient (registering mid-booking) as the one remaining path kept on
  pending_confirmation + 24h expiry, as an anti-fraud measure. That was
  revisited the same day and REMOVED too — every normal-flow booking
  (guest, unverified patient, verified patient) is confirmed immediately
  now. The only way pending_confirmation can still occur is admin
  tooling's statusOverride (e.g. the appointment generator) — never the
  real public wizard. The anti-fraud concern is instead handled entirely
  on the ACCOUNT side: an unverified patient's booking is confirmed and
  the slot held, but they can't log back into the patient portal
  (view/rebook) until they verify their email (PatientEmailVerificationGate,
  app/patient/(protected)/layout.tsx, unrelated to this step, already
  existed). finalizeVerifiedPatientBookings (lib/actions/patient.ts) and
  its PatientBookingFinalizer mount were removed entirely — there's no
  pending booking left for it to promote through the normal flow.
- REMOVED: confirmBooking() action, app/bookings/confirm/[token]/page.tsx,
  the sweep-expired-bookings cron route AND its GitHub Actions workflow
  (.github/workflows/sweep-cron.yml — not Vercel Cron as originally
  guessed), bookingUnderReviewEmailHtml, bookingCancelledClientHtml's
  byExpiry variant. pending_expiry_at column is kept in schema (not
  dropped) for historic-row/rollback safety, but nothing sets it anymore
  outside statusOverride's rare pending_confirmation path.
- BUG FIXED along the way (6d13019): guests were briefly being sent a
  "manage your booking" link pointing at /patient/login, which they have
  no credentials for (a guest has no account). Fixed: only an actually-
  authenticated patient gets the login-portal manageUrl; a true guest gets
  the same token-based cancel/manage page guest bookings always used.
- NEW: `clinic_reviewed_at` (timestamptz, nullable) on kalendar_bookings —
  mirrors the existing `cancellation_requested_at` pattern (a flag layered
  on top of `status`, not a new status value, since the booking is
  genuinely confirmed/slot-held either way). Set only by an explicit
  clinic action, never automatically: a "Contactado / Confirmado" button.
  markBookingReviewedAsOwner (lib/actions/booking-owner.ts) sets it,
  scoped to the caller's business; no dedicated error dict entry beyond
  the existing errUpdateFailed.
- The flag clears the moment clinic_reviewed_at is set — it does NOT
  re-derive from clientStatus alone, since clientStatus (guest_confirmed)
  stays true for the booking's whole lifetime and would never let the
  clinic mark it as handled.
- Guest-vs-patient distinction for surfacing this: still comes from
  `clientStatus` (lib/booking/client-status.ts) — patient_id null = guest.
  RESOLVED (was an open question in the original design): guest_unconfirmed
  is KEPT in the ClientStatus type/UI rather than deleted, even though the
  normal flow can no longer produce it — statusOverride (admin tooling)
  is still a real, if rare, way to get a guest-shaped (patient_id null)
  pending_confirmation row, and the existing UI already handles it
  correctly, so removing it would just be code churn for no benefit.
- Calendar grid view (calendar-grid-view.tsx, day/week views): guest
  bookings get a small colored dot marker, shown whenever
  clientStatus === "guest_confirmed" AND clinicReviewedAt is null (dot
  hidden once reviewed). Colors as actually shipped: guest_unconfirmed
  (the rare statusOverride case) = amber-500, guest_confirmed
  (not-yet-reviewed) = sky-500. Tooltip/label shows "Invitado · confirmado"
  or the client-status label depending on state.
- Guest bookings remain flagged indefinitely until clinic_reviewed_at is
  set — no automatic expiry of the highlight itself.
- The "Clientes" tab (calendar-management-upcoming.md's
  pending-guest-requests step) was updated in the same implementation —
  see that file for its own detail: it now shows full guest history
  (past + upcoming, via the new getClientRowBookings query), not
  upcoming-only, and its per-row action is "mark reviewed" rather than
  confirm/cancel.
- Reference commits: 159c05a ("guest bookings confirm immediately, clinic
  follow-up flag replaces 24h expiry") and 6d13019 ("a patient's first
  (unverified) booking also confirms immediately"), both
  stanize/kaminolabs-kalendar, 2026-09-13.

## Step: booking-abuse-protection
Status: in_progress
Criteria:
- PENDING TESTING + PENDING LIVE MIGRATION (2026-09-19): code implemented
  and typechecked/linted clean, but not yet exercised in a running app —
  AND supabase/schema_subset_008.sql (kalendar_rate_limit_hits table +
  increment_rate_limit_hit function) hasn't been run against the live DB
  yet. Nothing in this step works in production until Arun runs that file
  in the Supabase SQL editor. Don't flip to `done` until both the
  migration has run AND the flow's been exercised for real.
- IMPLEMENTED (2026-09-19) — Phase 1 honeypot: a `website` text input in
  the guest-details view of booking-wizard.tsx (ConfirmAuthModal), kept
  off-screen via `absolute h-0 w-0 opacity-0` (not display:none/
  type=hidden, per the design note below). Wired through as
  submitBooking's new `honeypot` param — any non-empty value returns a
  FAKE success (a real token, no DB write) rather than a real error, so a
  bot believes it worked.
- IMPLEMENTED (2026-09-19) — rate limiting, REVISED FROM THE ORIGINAL
  "5/day flat per IP per endpoint" design below (Arun, 2026-09-19): for
  submitBooking specifically, it's now a SINGLE per-IP-per-day counter
  (shared across guest and authenticated attempts from that IP) whose
  ALLOWED THRESHOLD varies by the current request: 5/day if the request
  is a guest booking, 10/day if it's an authenticated patient booking
  (verified via the session-derived patientId, never the client-passed
  one — can't be spoofed to claim the higher threshold). This replaces
  the flat 5/day for THIS endpoint only — the original "5/day per IP per
  endpoint, three independent endpoints sharing one mechanism" framing
  below still holds for clinic/patient SIGNUP (not yet built, tracked in
  their own files), which don't have a guest/authenticated distinction to
  vary the threshold by.
- IMPLEMENTED (2026-09-19) — shared mechanism: kalendar_rate_limit_hits
  table (endpoint, ip_key, day, count) + increment_rate_limit_hit()
  Postgres function (atomic upsert-increment in one round trip — a plain
  JS-client upsert can't reference the row's own current value) — matches
  the IMPLEMENTATION note below, built exactly as designed there.
  lib/rate-limit.ts wraps it (incrementRateLimitHit, getClientIp — reads
  x-forwarded-for). Only submitBooking calls it today.
- IMPLEMENTED (2026-09-19) — on exceeding the limit: matches the "real,
  visible error, not the honeypot's silent-success trick" design below,
  but with an added twist Arun asked for: the message is deliberately
  generic ("no ha sido posible completar tu solicitud en este momento")
  rather than saying "rate limit exceeded" outright, paired with a
  stable, decodable code (BK-4029 for a guest hitting the limit, BK-4030
  for an authenticated patient) that Arun can map back to "which limit
  tripped" if a real person quotes it to support, without a scripted
  abuser learning exactly what mechanism blocked them from the message
  text alone.
- IMPLEMENTED (2026-09-19, same day, Arun follow-up) — admin-tooling
  exemption: the admin portal's appointment-generator dev tool
  (kaminolabs-kalendar-admin, /admin/appointment-gen) calls submitBooking
  directly via app/api/internal/appointment-gen/route.ts to bulk-create
  test bookings, and would have started hitting this same rate limit
  after 5-10 calls from the same IP. First attempt keyed the bypass off
  `statusOverride` being set — WRONG, caught before shipping: the admin
  tool's default "auto" mode sends statusOverride as undefined, so the
  common case wouldn't have been exempted at all. Fixed properly instead:
  lib/actions/booking.ts's submitBooking was split into a private
  `submitBookingImpl(input, skipRateLimit)` plus two thin exports —
  `submitBooking` (skipRateLimit always false, the only one
  booking-wizard.tsx may import) and `submitBookingInternal`
  (skipRateLimit always true, imported ONLY by the internal route). Since
  submitBookingInternal is never imported by a "use client" component, it
  never enters the Next.js Server Action client-reference manifest — a
  browser has no way to reach it or the bypass, forged request or not,
  unlike a boolean flag on the public-facing function would have been.
  app/api/internal/appointment-gen/route.ts now calls
  submitBookingInternal instead of submitBooking.
- SURFACED (2026-09-14, docs/reviews/2026-09-14-review.md — "Recommended
  next 3" #2): no captcha, honeypot, or rate limiting exists anywhere in
  submitBooking today. Flagged as MORE urgent than it would otherwise be
  specifically BECAUSE of guest-immediate-confirm-with-clinic-followup
  above — a spammed/scraped slug now gets junk bookings CONFIRMED
  immediately and mixed straight into a clinic's real calendar and real
  patient data, with no pending-review window to catch it before it lands.
  That review window existing was an accidental abuse-mitigation side
  effect of the old 24h design that nobody had named explicitly until it
  was gone.
- PHASE 1 (cheap, do first): a honeypot field in the booking wizard's
  final step — an input invisible to real users (off-screen/opacity-0, not
  display:none or type=hidden, since basic bots specifically check for
  those and skip them) but visible to naive form-filling bots. submitBooking
  rejects silently (pretend-success from the bot's point of view, so it
  doesn't learn to look elsewhere) if the field is non-empty. Zero user-
  facing friction for real guests — no puzzle, no click, nothing to see.
- PHASE 2 (escalate only if Phase 1 proves insufficient): Cloudflare
  Turnstile on the wizard's final step — invisible/managed mode preferred
  over a visible challenge, to keep friction low for real guests. Only
  worth building once actual junk volume is observed post-Phase-1, not
  preemptively — per the review, "cheap, and now more urgent" was about
  the honeypot specifically, not a recommendation to build both at once.
- RATE LIMITING — design finalized (2026-09-14, Arun): 5 submissions per
  IP per day, PER ENDPOINT (a separate counter per endpoint, not one
  shared budget across all three — a burst on one doesn't eat into the
  others). Applies to THREE endpoints, only one of which is this file's
  own concern:
  - submitBooking (this step, the guest booking wizard) — the one this
    step actually builds.
  - Patient signup (authClient.signUp.email calls in
    patient-login-form.tsx / booking-wizard.tsx's ConfirmAuthModal) —
    tracked in patient-portal.md, not here, since it's a distinct auth
    surface from booking itself even though one of the two call sites
    happens to live inside the booking wizard component.
  - Clinic signup (app/signup + SignupForm) — tracked in
    clinic-onboarding.md.
  All three should share the SAME underlying mechanism/table (see below)
  even though each gets its own independent counter — build it once,
  reuse it three times, not three separate implementations.
- IMPLEMENTATION for the shared rate-limit mechanism: a Postgres table in
  Supabase (e.g. kalendar_rate_limit_hits: endpoint text, ip_key text,
  day date, count int, composite primary key on the three) rather than
  an in-memory counter — in-memory doesn't work on Vercel's serverless
  functions, which don't share memory across invocations, and a Postgres
  table needs no new external dependency (Supabase's already open on
  every request). "Per day" buckets on a plain date column, not a rolling
  24h window — simpler to reason about and query. No Redis/Upstash for
  this phase; revisit only if request volume makes per-request Postgres
  writes a real cost, which is not expected at Kalendar's current scale.
- On exceeding the limit: a real, visible error — NOT the honeypot's
  silent-success trick. Message tells the person to contact support or
  try again later. Rationale for the different treatment from the
  honeypot: a legitimate person hitting this (flaky network, accidental
  double-submit, browser back-button retry) is a plausible trigger here
  in a way it isn't for a hidden field only a bot would ever touch — they
  deserve to know why it didn't go through, not be told a fake "success"
  that leaves them wondering why the clinic never got their booking.
- Basic rate limiting on submitBooking by IP and/or by (business_id, IP)
  is a reasonable Phase 1 companion to the honeypot — worth scoping
  alongside it rather than as a separate later step, since both are cheap
  and address the same underlying gap.
- SUPERSEDED: the note below about clinic/patient sign-up being
  out-of-scope no longer holds — see the rate-limiting bullet above,
  which now explicitly covers both, per Arun's 2026-09-14 decision to
  give every account-creating endpoint its own counter on the same shared
  mechanism. Kept the original line for history rather than deleting it.
- Out of scope for this step (not part of the review's recommendation,
  noted so a future pass doesn't assume it's covered): CAPTCHA/bot
  protection on clinic sign-up or patient portal sign-up — those aren't
  the public, no-auth surface the review is concerned about here.

## Step: cancellation
Status: done
Criteria:
- Cancel route exists at app/bookings/cancel/[token]/page.tsx
- cancel-booking-button.tsx wired to a token-based cancel action
- Booking status updates on cancellation

## Step: rescheduling
Status: not_started
Criteria:
- A dedicated reschedule flow exists that moves an existing booking to a new slot
- Reschedule does not require cancel + rebook
- Reschedule preserves booking identity/history (not a new row)

## Notes / Deviations
(freeform — anything found in code that doesn't map to a defined step)
