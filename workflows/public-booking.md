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
