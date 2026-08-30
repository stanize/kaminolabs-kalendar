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
Status: in_progress
Criteria:
- Booking detail modal lets the owner independently set payment status: paid or unpaid
- Payment status is independent of outcome (e.g. a no-show can still be marked paid; a completed session can be pending payment)
- Payment status change is scoped to the calling business
- NOT BUILT: when marking a booking paid, the owner must also select a payment method — cash, card, or (if the client has any active bono) one option per active bono, individually labeled. The selector only appears once the paid toggle is switched on — not shown at all while unpaid — and opens inline next to that toggle. If the client has an active bono, the oldest one defaults as pre-selected; the clinic can override to cash, card, or a different bono. kalendar_bookings needs a new payment_method column (text, nullable, meaningful only when payment_status = 'paid') plus a reference to which specific bono was used when applicable (FK to kalendar_bono_purchases, nullable) — see bonos.md's session-deduction-on-payment step for full detail
- Selecting a bono option deducts one session from that specific bono automatically — see bonos.md
- DECIDED: once a booking's payment_method is set to a bono, that field locks in this modal — cash <-> card stays freely editable anytime, but switching away from a bono is blocked here with a message pointing to the Bonos page instead. This is deliberate, not a bug — see bonos.md's bono-session-reversal step for where that correction actually happens
- Switching an already-paid booking's method after the fact (e.g. correcting a mistaken cash/bono selection) needs a defined behavior — does changing away from "bono" restore the deducted session? Not yet decided, flagged in bonos.md too

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
- SUPERSEDED BY clinic-clients-page.md — this step's criteria (client-linking-on-booking, denormalized-counters-updated) now live there in more detail, since the clinic clients page is the actual place a per-client history would surface. Kept here as a pointer rather than removed, since this step originated from a calendar-management-past.md discussion.

## Notes / Deviations
- updateBookingResult's own code comment flags that it does NOT yet update kalendar_clients' denormalized session counters (total_sessions/completed_count/etc.) because clinic_client_id isn't populated by any write path yet — this is the direct cause of the client-session-history step being not_started, not a separate unrelated gap.
- There is no dedicated "past" tab or route today — past appointments are only reachable by viewing the day/week/month grid and scrolling/paging backward, or by opening a chip that happens to be in the past. Confirm with Arun whether a dedicated history view is wanted, or whether grid-backward-navigation is considered sufficient by design.
