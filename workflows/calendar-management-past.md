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
- When marking a booking paid, the owner must also select a payment method — cash, card, or (if the client has any active bono) one option per active bono, individually labeled. The selector only appears once the paid toggle is switched on — not shown at all while unpaid — and opens inline next to that toggle. If the client has an active bono, the oldest one defaults as pre-selected; the clinic can override to cash, card, or a different bono. kalendar_bookings has a payment_method column (text, nullable, meaningful only when payment_status = 'paid') plus bono_purchase_id (FK to kalendar_bono_purchases, nullable) — see bonos.md's session-deduction-on-payment step for full detail
- Selecting a bono option deducts one session from that specific bono automatically — see bonos.md
- DONE: the payment-method lock is one-directional. Switching INTO a bono (from cash, from card, or first-time selection) is always allowed in this modal, anytime, including retroactively on an old booking — deducts a session normally, per bonos.md. Switching AWAY from a bono (bono -> cash, bono -> card, or bono -> a different bono) is what's blocked here — attempting shows a message pointing to the Bonos page instead.
- RESOLVED (2026-09-18, verified against code — previously read "KNOWN GAP: switching an already-paid booking's method after the fact by flipping it back to unpaid clears the payment_method/bono_purchase_id link but does NOT restore a deducted session"): this was fixed by the sync_bono_session_usage trigger (supabase/schema_001.sql:942-1001, also lib/actions/booking-owner.ts:386-394) — any write that clears/changes bono_purchase_id now symmetrically restores the old bono's session, regardless of code path. No longer a gap.

## Step: past-appointment-editing
Status: done
Criteria:
- VERIFIED (2026-09-18, against code): updateBookingAsOwner (lib/actions/booking-owner.ts:785-900) lets the owner edit an existing booking's service, provider, time, client name/email/phone, and notes with no guard against the booking being in the past — it only validates business ownership, service/provider existence, and slot-conflict. Both open questions resolve to "yes": editing works generally, and time/service/provider CAN be changed on a past booking, not just outcome/payment.

## Step: history-browsing
Status: not_started
Criteria:
- A dedicated past-appointments list/history view exists, independent of navigating the week/month grid backward one page at a time
- History is filterable by date range, client, service, or provider
- History is searchable (e.g. by client name)

## Step: client-session-history
Status: done
Criteria:
- SUPERSEDED BY clinic-clients-page.md — this step's criteria (client-linking-on-booking, denormalized-counters-updated) now live there in more detail, since the clinic clients page is the actual place a per-client history would surface. Kept here as a pointer rather than removed, since this step originated from a calendar-management-past.md discussion. Both superseding steps shipped 2026-08-25 and are marked done there — this pointer is marked done to match, not tracked independently.

## Notes / Deviations
- RESOLVED (2026-08-25, see clinic-clients-page.md): updateBookingResult now DOES update kalendar_clients' denormalized session counters (total_sessions/completed_count/etc.) — the code comment this note used to reference (and clinic_client_id not being populated by any write path) is no longer accurate; both client-linking-on-booking and denormalized-counters-updated are done.
- There is no dedicated "past" tab or route today — past appointments are only reachable by viewing the day/week/month grid and scrolling/paging backward, or by opening a chip that happens to be in the past. Confirm with Arun whether a dedicated history view is wanted, or whether grid-backward-navigation is considered sufficient by design.
