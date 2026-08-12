# Workflow: Calendar Management — Upcoming Appointments

The clinic's view of the calendar for today and the future: reviewing pending guest requests, viewing the day/week/month grid, and creating/editing appointments manually.

## Step: calendar-views
Status: done
Criteria:
- /app/panel/calendar/page.tsx renders day, week, and month views (CalendarHeader view switcher)
- Week view is Outlook-style, one column per provider (calendar-grid-view.tsx)
- Month view exists (calendar-month-view.tsx)
- Prev/Next/Today navigation works for all three view modes
- Upcoming bookings only show active statuses (pending_confirmation, confirmed) — cancelled/past-cancelled stay hidden going forward

## Step: pending-guest-requests
Status: done
Criteria:
- "Pendientes" tab exists, separate from the day/week/month grid (calendar-bookings.tsx)
- Flat list, no day grouping, sorted soonest-expiry-first
- Live countdown badge (CountdownBadge) re-renders every 60s, turns urgent under 2h remaining
- confirmBookingAsOwner transitions pending_confirmation -> confirmed, clears pending_expiry_at, emails guest a confirmation receipt with ICS attachment
- A guest booking not confirmed before its expiry is auto-expired by the reminders/cron sweep (not confirmed) — see appointment-reminders workflow

## Step: manual-appointment-creation
Status: done
Criteria:
- Clicking an open slot in the week grid opens AppointmentModal
- Owner-created bookings are confirmed immediately (no pending-confirmation window)
- Client email is optional; confirmation email only sent if provided AND sendConfirmationEmail is true
- Double-booking prevented at creation (errSlotTaken on conflict)
- Service and provider selection validated server-side (errInvalidService / errInvalidProvider)

## Step: appointment-editing
Status: done
Criteria:
- updateBookingAsOwner allows editing an existing upcoming booking (service, time, provider, client details)
- Edits are scoped to the calling business (booking must belong to business_id)
- Edited booking's slot conflict is re-validated on save

## Step: owner-cancellation
Status: done
Criteria:
- cancelBookingAsOwner is scoped to the caller's business (business_id match required)
- Only pending_confirmation or confirmed bookings can be cancelled (errCannotCancel otherwise)
- Cancelling frees the slot (active-slot unique index excludes cancelled rows)
- Client is notified by email on owner-initiated cancellation (best-effort, notifyCancellation)

## Step: cancellation-request-review
Status: done
Criteria:
- A booking within the clinic's configured cancellation window (see clinic-configuration.md's cancellation-window-setting, default 24h) that a patient tries to self-cancel produces a cancellation *request* rather than an immediate cancel (see patient-portal.md's self-service-cancel step for the patient-facing half of this)
- Pending cancellation requests are visible to the owner in a dedicated "Cancelaciones" tab in the panel calendar, sorted soonest-requested-first (mirrors Pendientes tab's expiry-sort rationale)
- A rose-styled panel-home widget (CancellationRequestsWidget) surfaces the pending count and deep-links to the Cancelaciones tab; only rendered when count > 0
- reviewCancellationRequest handles both decisions, scoped to the caller's business: approve sets status → cancelled and clears the request flag (client gets the standard cancellation receipt via notifyCancellation); deny clears the request flag only, booking status is untouched, client gets a dedicated "request denied" email (notifyCancellationRequestDenied) instead
- Slot stays held while a request is pending — status remains pending_confirmation/confirmed throughout, cancellation_requested_at is a separate flag layered on top rather than a status value, so the request doesn't free the slot for another booking until actually approved
- Mobile-friendly Cancelaciones tab uses standard buttons rather than a layout that breaks on narrow viewports

## Step: reminder-failure-visibility
Status: done
Criteria:
- reminder_send_failed / last_reminder_error surface as an amber warning marker on the week-grid chip
- Failure detail (error text) shown in the booking detail modal
- No retry action exists from this view (visibility-only, by design — see appointment-reminders workflow)

## Notes / Deviations
(freeform — anything found in code that doesn't map to a defined step)
