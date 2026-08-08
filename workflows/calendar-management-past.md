# Workflow: Calendar Management — Past Appointments

The clinic's view of appointments after their scheduled time has passed: reviewing what happened, marking outcome/payment, and scanning history.

## Step: past-appointment-visibility
Status: done
Criteria:
- Past bookings remain visible in the week/day grid regardless of status (unlike upcoming, which hides non-active statuses)
- Past bookings are visually distinguished from upcoming ones (chipClasses: teal = upcoming, rose = past-unreviewed, slate = past-reviewed)
- "Past" is determined by comparing startIso to current time client-side, not a stored flag
- Appointments remain clickable in any state — past appointments can be revised

## Step: mark-result
Status: done
Criteria:
- Booking detail modal lets the owner set a past booking's outcome: completed, no_show, or cancelled (updateBookingResult)
- Outcome update is scoped to the calling business (business_id match required)
- Setting an outcome moves the chip from "past-unreviewed" (rose) to "past-reviewed" (slate) styling

## Step: mark-payment
Status: done
Criteria:
- Booking detail modal lets the owner independently set payment status: paid or unpaid
- Payment status is independent of outcome (e.g. a no-show can still be marked paid; a completed session can be pending payment)
- Payment status change is scoped to the calling business

## Step: past-appointment-editing
Status: unclear
Criteria:
- Determine whether updateBookingAsOwner (or an equivalent) allows editing a past booking's details (client info, notes) after the fact, separately from outcome/payment
- Determine whether time/service/provider can still be changed on a past booking, or only outcome+payment

## Step: history-browsing
Status: not_started
Criteria:
- A dedicated past-appointments list/history view exists, independent of navigating the week/month grid backward one page at a time
- History is filterable by date range, client, service, or provider
- History is searchable (e.g. by client name)

## Step: client-session-history
Status: not_started
Criteria:
- Past appointments roll up into a per-client history (total sessions, completed count, no-show count)
- kalendar_bookings.clinic_client_id is populated by at least one write path (manual booking or guest wizard) so past bookings can be linked to a client record
- Denormalized session counters on kalendar_clients are kept in sync when a booking's result changes

## Notes / Deviations
- updateBookingResult's own code comment flags that it does NOT yet update kalendar_clients' denormalized session counters (total_sessions/completed_count/etc.) because clinic_client_id isn't populated by any write path yet — this is the direct cause of the client-session-history step being not_started, not a separate unrelated gap.
- There is no dedicated "past" tab or route today — past appointments are only reachable by viewing the day/week/month grid and scrolling/paging backward, or by opening a chip that happens to be in the past. Confirm with Arun whether a dedicated history view is wanted, or whether grid-backward-navigation is considered sufficient by design.
