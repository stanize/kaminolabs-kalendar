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
- SUPERSEDED (2026-10-07, see cobrar-button-and-paid-at below) — the "toggle + inline selector" entry point described in this step's bullets below is being replaced by a "Cobrar" button + modal. The underlying payment-method/bono rules (default-oldest, one-directional lock) are unchanged and still described here; only the trigger UI moves to the new step.
- When marking a booking paid, the owner must also select a payment method — cash, card, or (if the client has any active bono) one option per active bono, individually labeled. The selector only appears once the paid toggle is switched on — not shown at all while unpaid — and opens inline next to that toggle. If the client has an active bono, the oldest one defaults as pre-selected; the clinic can override to cash, card, or a different bono. kalendar_bookings has a payment_method column (text, nullable, meaningful only when payment_status = 'paid') plus bono_purchase_id (FK to kalendar_bono_purchases, nullable) — see bonos.md's session-deduction-on-payment step for full detail
- Selecting a bono option deducts one session from that specific bono automatically — see bonos.md
- DONE: the payment-method lock is one-directional. Switching INTO a bono (from cash, from card, or first-time selection) is always allowed in this modal, anytime, including retroactively on an old booking — deducts a session normally, per bonos.md. Switching AWAY from a bono (bono -> cash, bono -> card, or bono -> a different bono) is what's blocked here — attempting shows a message pointing to the Bonos page instead.
- RESOLVED (2026-09-18, verified against code — previously read "KNOWN GAP: switching an already-paid booking's method after the fact by flipping it back to unpaid clears the payment_method/bono_purchase_id link but does NOT restore a deducted session"): this was fixed by the sync_bono_session_usage trigger (supabase/schema_001.sql:942-1001, also lib/actions/booking-owner.ts:386-394) — any write that clears/changes bono_purchase_id now symmetrically restores the old bono's session, regardless of code path. No longer a gap.

## Step: cobrar-button-and-paid-at
Status: in_progress
Criteria:
- CODE IMPLEMENTED, TYPECHECKED, LINTED, BUILD PASSES (2026-10-07). MIGRATION RUN against the live DB (2026-10-07, Arun confirmed). Still pending Arun's manual/live testing of the actual feature — not `done` yet.
- `paid_at` added to `kalendar_bookings` (`supabase/schema_subset_022.sql`, folded into `schema_001.sql`, shared with bonos-visibility-toggle's `bonos_enabled` column in the same file).
- `updateBookingResult` (`lib/actions/booking-owner.ts`) sets `paid_at = now()` only on an actual unpaid -> paid transition (compares against the booking's currently-saved `payment_status`, fetched freshly in the same call — re-saving while already paid, e.g. cash -> card, leaves the original `paid_at` untouched), and clears it on paid -> unpaid, mirroring the existing `bono_purchase_id` symmetric clear/restore.
- IMPLEMENTATION DEVIATION — `status` is now OPTIONAL on `updateBookingResult`'s input (was required). The Cobrar button charges immediately on tapping Efectivo/Tarjeta/a bono (`handleCobrar`, `components/panel/booking-detail-modal.tsx`), independent of whatever Resultado the owner has or hasn't chosen yet — there was no clean way to keep `status` required without forcing a Resultado choice before charging, which the spec never asked for. When omitted, the booking's `status` column is left untouched entirely (no write, no counters-update side effect). The existing Resultado "Guardar" flow (`handleSaveResult`) is unchanged in behavior — it still always supplies `status`, and now explicitly re-sends the booking's unchanged payment state alongside it (previously `payment`/`paymentMethod` were shared mutable UI state between the two concerns; they no longer are).
- BEHAVIOR CHANGE FROM mark-payment'S "DONE" BULLET ABOVE — flagging explicitly since it narrows something previously decided: once a booking is marked paid, this modal now shows ONLY the static "Pagado con {método} · {hora}" summary (per the spec below) with **no further edit affordance here at all** — not even the previously-freely-allowed cash <-> card correction or a retroactive switch into a bono. That editing capability is gone from this surface; the only way to correct a paid booking's method now is: unpaid-flip then re-Cobrar (loses the original `paid_at`, which then resets), or (for a bono specifically) the Bonos page's existing reversal flow. Not re-confirmed with Arun as an explicit trade-off — flag for review if this turns out to matter in practice (e.g. a common "oops, picked cash instead of card" correction need).
- Cobrar modal's bono buttons gated by `bonosEnabled`, threaded `app/panel/calendar/page.tsx` -> `CalendarBookings` -> `BookingDetailModal`, same pattern as the existing `whatsappEnabled` thread. Bono list (`getActiveBonosForClientAction`) is now fetched on Cobrar-modal-open rather than on payment-toggle (there is no more payment toggle).
- `paidAt` threaded end-to-end through `WeekViewBooking`/`WeekBookingVM` (both `lib/booking/owner-data.ts` query sites — week-grid fetch and conflicts — plus `calendar-grid-view.tsx`'s type and the `app/panel/calendar/page.tsx`/`calendar-bookings.tsx` literal mappings that build these objects).
- SPEC (2026-10-07, Arun) — a UX relabel/restyle of mark-payment above, not a parallel flow: the existing paid/unpaid toggle + inline payment-method selector becomes a **"Cobrar"** button, shown on any past appointment that's not yet paid. Clicking it opens a modal rather than an inline selector.
- DECIDED: the modal shows **Efectivo** and **Tarjeta** as two large buttons by default. A **bono option per active bono** also appears in that same modal — but ONLY when the clinic has `bonos_enabled = true` (clinic-configuration.md's bonos-visibility-toggle) AND the client has at least one active bono with sessions remaining. If `bonos_enabled` is false, the bono option(s) never appear in this modal regardless of whether the client has bonos on record — matches that step's "forward-looking" gating, doesn't touch historical data.
- Selecting Efectivo/Tarjeta/a bono does exactly what the existing mark-payment flow already does: sets `payment_status = 'paid'`, sets `payment_method` accordingly, and (bono only) triggers the existing `sync_bono_session_usage` deduction per bonos.md — no new payment logic, this step only changes the trigger UI (button + modal) and adds the timestamp below.
- NEW COLUMN: `kalendar_bookings.paid_at` (timestamptz, nullable) — set to `now()` whenever `payment_status` transitions to `'paid'` (whichever write path does it: this modal, a direct booking edit, or any future path) and cleared when it transitions back to `'unpaid'` (mirrors how `bono_purchase_id` is already symmetrically cleared/restored on unpaid-flip, per mark-payment's resolved note below). Decided to add a dedicated column rather than reuse `updated_at`, since `updated_at` can change for unrelated edits (notes, time, client details) and would misrepresent the payment moment.
- DECIDED: once paid, the Cobrar button is hidden and replaced with a payment summary reading **"Pagado con {método} · {hora}"** (e.g. "Pagado con tarjeta · 14:32"), using `payment_method` + `paid_at` (formatted as local time, no date — matches the existing booking-detail-modal's time-only conventions elsewhere). No amounts, no receipts, no running totals — matches the spec's explicit non-goals.
- LOCATION DECIDED (2026-10-07, Arun): Cobrar/paid-summary lives in the booking detail modal only, same place today's toggle+selector already lives — not duplicated onto the calendar list/grid row.
- Everything else about mark-payment's already-decided behavior (bono default-oldest-selection, the one-directional bono lock, outcome independence) is unchanged — this step only changes the entry point (button instead of toggle, modal instead of inline) and adds `paid_at`.
- Migration: add `paid_at` via a new `supabase/schema_subset_NNN.sql` (next sequential number) plus folding into `schema_001.sql`, per CLAUDE.md's migration convention — this table already has real rows.

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
- `cobrar-button-and-paid-at` (2026-10-07) is cross-referenced from bonos.md and clinic-configuration.md's bonos-visibility-toggle — update all three together if this design changes.
