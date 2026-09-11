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
Status: not_started
Criteria:
- A visible step-progress bar is rendered at the top of the wizard (numbered circles connected by a line, current step highlighted, e.g. "① Servicio → ② Fecha/Hora → ③ Detalles → ④ Confirmación") — inspired by a reference service (clinic-cloud.com)'s "Tratamientos / Calendario / Solicitud / Reserva" indicator
- Internal step state already exists (booking-wizard.tsx's Step type: service | provider | date | done) — this is a UI addition on top of existing state, not a new state machine
- Step labels adapt correctly whether the business is solo (3 visible steps: service, date, confirm) or team (4 visible steps: service, provider, date, confirm) — matches the existing conditional skip of the provider step for solo businesses
- Works on mobile widths without wrapping awkwardly (this is a phone-first booking flow)

## Step: appointment-summary-recap
Status: not_started
Criteria:
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
Status: not_started
Criteria:
- DECISION (supersedes the old pending-confirmation-review step below, which
  is now REMOVED — see "Superseded" note at the bottom of this step): Arun
  decided to drop the 24h guest auto-expiry system entirely. A guest booking
  is now `confirmed` immediately on submit if the slot is available — same
  as an authenticated/verified patient booking. No more `pending_confirmation`
  status for guests, no more `pending_expiry_at` deadline, no more
  confirm-by-email-token flow.
- Rationale (Arun): auto-cancelling a guest's appointment because they
  didn't click an email link within 24h was causing lost bookings for no
  real benefit — better to hold the slot and let the clinic proactively
  reach out to unfamiliar guests to reduce no-shows, rather than silently
  killing the reservation.
- REMOVE (dead code once built): app/bookings/confirm/[token]/route.ts
  (confirm-by-link page), app/api/cron/sweep-expired-bookings/route.ts (and
  its vercel.json cron entry), CountdownBadge (components/panel/
  calendar-bookings.tsx), the confirmBookingAsOwner pending->confirmed
  transition path, bookingCancelledClientHtml/bookingCancelledOwnerHtml's
  byExpiry email variant, pending_expiry_at column usage (submitBooking no
  longer sets it — leave the column in schema for now, don't drop it, in
  case of historic rows/rollback).
- NEW: a `clinic_reviewed_at` timestamp column on kalendar_bookings
  (nullable, default null) — mirrors the existing
  `cancellation_requested_at` pattern (calendar-management-upcoming.md's
  cancellation-requests step): a flag layered on top of `status` rather
  than a new status value, since the booking is genuinely confirmed/slot-
  held either way. Set only by an explicit clinic action (a "Contacted /
  Confirmed" button — exact label TBD), never automatically.
- The highlight/flag described below clears the moment clinic_reviewed_at
  is set — it does NOT re-derive from clientStatus alone, since
  clientStatus (guest_confirmed) stays true for the booking's whole
  lifetime and would never let the clinic mark it as handled.
- Guest-vs-patient distinction for surfacing this (unaffected by this
  change): still comes from `clientStatus` (lib/booking/client-status.ts) —
  patient_id null = guest. Note `guest_unconfirmed` becomes DEAD going
  forward (pending_confirmation no longer occurs for guests) — every guest
  booking is `guest_confirmed` from creation. OPEN QUESTION: worth
  simplifying the ClientStatus type to drop guest_unconfirmed once the old
  path is fully removed, or leave it for now in case statusOverride/admin
  tooling still produces a pending_confirmation guest row? Decide at
  implementation time, not blocking this design.
- Calendar grid view (calendar-grid-view.tsx, day/week views): guest
  bookings get a visible marker (dot/badge — exact styling TBD at build
  time, amber_500 already used elsewhere for guest-adjacent cases so a
  distinct color, not that Model Bank installation, may read better) shown
  whenever clientStatus === guest_confirmed AND clinic_reviewed_at is
  null. Marker's tooltip/label should read approximately "Guest booking —
  no clinic follow-up yet" (copy TBD) to make clear WHY it's flagged, since
  the guest booking is already confirmed and this isn't asking the clinic
  to approve anything, just to reach out.
- Guest bookings remain visible/highlighted this way indefinitely until
  clinic_reviewed_at is set — no automatic expiry of the highlight itself
  (only the old pending_confirmation status expired; this flag doesn't).
- Superseded: the OLD "Clientes" tab redesign (calendar-management-
  upcoming.md's pending-guest-requests step) needs updating to match — see
  that file, its Criteria there currently describes the now-removed
  countdown/expiry behavior and needs a rewrite alongside this step's
  implementation, not left half-stale. Also extend that tab's date range:
  Arun wants it to show BOTH upcoming and past guest bookings (full guest
  history for no-show tracking), not upcoming-only as it currently is.

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
