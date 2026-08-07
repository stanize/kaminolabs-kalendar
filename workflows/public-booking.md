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

## Step: pending-confirmation-review
Status: done
Criteria:
- Guest bookings requiring owner review land in pending_confirmation status
- "Pendientes" tab in panel calendar lists them sorted soonest-expiry-first
- confirmBookingAsOwner transitions pending_confirmation -> confirmed and emails guest
- A separate cron sweep expires (not confirms) stale pending bookings

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
