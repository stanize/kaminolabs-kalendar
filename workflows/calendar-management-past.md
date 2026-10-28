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
- SUPERSEDED (2026-10-07, see cobrar-button-and-paid-at below) — the standalone three-way Resultado picker (Completada/No-show/Cancelada + separate Guardar) described in this step's bullets is REMOVED. Per Arun: a past appointment only ever lands in one of three terminal states, and the UI now reflects that directly rather than asking for a result and a payment separately — Cobrar (paid) also marks it completed in the same action, No-show is its own one-tap button next to Cobrar, and Cancelada is read-only here (set via the normal cancel flow, not chosen in this section). `updateBookingResult` itself still supports an arbitrary `status` value server-side (unchanged, still scoped to the calling business) — only the picker UI is gone.
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
Status: done
Criteria:
- TESTED (2026-10-07, Arun, live, after the four follow-up passes and the No-show/Editar bug fix below): confirmed working — "works well."
- CODE IMPLEMENTED, TYPECHECKED, LINTED, BUILD PASSES (2026-10-07). MIGRATION RUN against the live DB (2026-10-07, Arun confirmed).
- FURTHER SIMPLIFICATION (2026-10-07, second pass, Arun — "too busy", screenshot-driven): the separate Resultado section (Completada/No-show/Cancelada buttons + a Guardar step) is removed entirely from the past-booking modal. Arun's reasoning, confirmed: once an appointment's time has passed, it only ever ends up in one of three terminal states — paid, no-show, or already cancelled (via the pre-existing, unrelated cancel flow) — so there's nothing left to separately "choose" once one of those happens.
  - **Cobrar** (`variant="primary"`, now visibly styled as a real button — Arun's screenshot showed it rendering as plain text, flagged and fixed) and a smaller **No-show** button (`variant="outline" size="sm"`) render side by side when a past booking is unresolved (not yet paid, not no-show, not cancelled).
  - DECIDED: tapping Cobrar (Efectivo/Tarjeta/bono, same modal as before) now sets BOTH `payment_status = 'paid'` AND `status = 'completed'` in the same write (`handleCobrar`) — paying a past appointment implies it happened, no separate completed choice needed.
  - No-show (`handleNoShow`) saves immediately on tap — `status = 'no_show'`, payment left exactly as it was (re-sends the booking's current unchanged payment_method, same pattern used elsewhere in this file) — no Guardar step, matching Cobrar's immediacy.
  - Once resolved, the Pago section shows a plain read-only label instead of the two buttons: the existing "Pagado con {método} · {hora}" summary when paid, "No-show" when no_show, or "Cancelada" when the booking's status is already `cancelled` (an already-cancelled past booking just shows that state here, nothing actionable — cancelling itself is unrelated to this section).
  - The bottom-of-modal "Cancelar" button is now a plain close/dismiss only (no Guardar next to it — nothing here is ever a staged, unsaved edit anymore).
  - Dictionary cleanup: `detailModal.resultLabel`/`resultCompleted` removed from `lib/i18n/dictionaries/calendar.ts` (both locales) — no longer referenced anywhere. `resultNoShow`/`resultCancelled` are kept and reused as the terminal-state labels described above.
- EDIT AFFORDANCE ADDED (2026-10-07, third pass, Arun — "want an edit option in case the clinic made a mistake"): a resolved Pago state (paid or no-show — not cancelled, that stays read-only since cancelling is unrelated) now shows a small **"Editar"** link next to the summary/label. Tapping it re-reveals the Cobrar/No-show buttons (local `editingPayment` state, `components/panel/booking-detail-modal.tsx`) so the clinic can pick a different outcome — e.g. correct cash to card, flip a mistaken no-show to paid, or vice versa. No new server action: it's the exact same `handleCobrar`/`handleNoShow` writes as the first-time case, just re-triggerable. The existing one-directional bono lock still applies unchanged (switching AWAY from an already-applied bono via Editar still gets `errBonoLocked`, same message pointing to the Bonos page) — Editar does not bypass it, it only re-exposes the same entry points.
  - BUG FOUND + FIXED (2026-10-07, same day, Arun live-tested): switching an already-paid booking to No-show via Editar left the stale "Pagado con {método} · {hora}" summary showing even though the grid chip and `status` correctly updated to No-show. Cause: `handleNoShow` re-sent the booking's PREVIOUS (pre-edit) `paymentStatus`/`paymentMethod` unchanged instead of clearing them — it only ever intended to leave payment untouched for the common case (marking a never-paid booking as No-show, where there's nothing to clear), but that same code path also ran on the Editar-triggered correction, where it needed to actively clear a payment that was already there. Fixed: `handleNoShow` now always sends `paymentStatus: "unpaid"` with no `paymentMethod` — No-show and Pagado are the two mutually exclusive terminal states per Arun's original framing, so marking one always clears the other. Reuses `updateBookingResult`'s already-existing unpaid-flip behavior, which also correctly restores a deducted bono session via `sync_bono_session_usage` when the cleared booking was bono-paid.
- QUICK-OVERVIEW LABEL ON THE GRID (2026-10-07, fourth pass, Arun — "add the pagado, no show label in the appointment slot as well"): a past booking's week-grid chip (`components/panel/calendar-grid-view.tsx`) now shows its resolved state — "Pagado" (reusing `detailModal.paymentPaid`), "No-show" (`resultNoShow`), or "Cancelada" (`resultCancelled`) — via a new `pastResultLabel()` helper. Null (nothing shown) for a past booking that's still unreviewed, since the existing rose/slate chip-color coding already answers Arun's second question below on its own.
  - FOLLOW-UP (2026-10-07, same day, Arun — "move the label to the third line, it does not appear so clearly on the second line"): moved from being appended inline to "{hora} · {cliente}" onto its own third line (bold, truncated) instead — the chip was too narrow for "· Pagado"/"· No-show" to read clearly stacked after the client name. Known minor trade-off, not addressed: a three-line chip can exceed the grid's 30px minimum slot height for a very short (e.g. 15-min) past appointment, which would get clipped by the chip's `overflow-hidden` — not reported as an issue yet, flag if it comes up.
- EXISTING ANSWER TO "how do we indicate nothing's been done for a past appointment" (not new, just confirmed/surfaced in this pass): `chipClasses()` in the same file already does this — a past booking still `pending_confirmation`/`confirmed` (i.e. neither paid nor no-show nor cancelled) renders **rose** (`bg-rose-50 text-rose-900 border-l-4 border-rose-500`); once resolved (completed/no_show/cancelled) it renders **slate** (receded/done). This predates the Cobrar/No-show work and needed no change — flagging here only so a future session doesn't re-derive or re-build it.
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

## Step: payment-cancellation-flow-expansion
Status: in_progress
Criteria (design settled 2026-10-28, Arun, from an uploaded
spec-appointment-modal-payment.md handoff doc; code implemented +
typechecked/linted/built same session, PENDING MANUAL/LIVE TESTING and
the live-DB migration):
- SOURCE SPEC WAS STALE: the handoff doc's own "Current state" section
  (PAGO only on past bookings, Efectivo/Tarjeta only, no invoice trigger)
  doesn't match this repo — it was written without seeing
  `cobrar-button-and-paid-at` (above) or `pdf-invoicing.md`'s
  invoice-on-payment-trigger, both already built and working. Checked the
  spec's proposals against real schema/code before accepting any of them;
  several conflicted and are explicitly NOT being built as specced — see
  below. This step is the reconciled version: the spec's genuinely new
  ideas, layered onto what already exists, not a replacement for it.
- NOT BUILDING, and why:
  - A separate `kalendar_payments` table — payment already lives directly
    on `kalendar_bookings` (`payment_status`, `payment_method`, `paid_at`,
    `bono_purchase_id`), and that existing model is what makes bono
    payments work (session deduction, the one-directional bono lock). The
    spec's proposed table and its 7-method list have no bono option at
    all; a parallel payments table would either drop bono support or
    require reconciling two different payment representations for no
    real benefit. Extending the existing `payment_method` check
    constraint's allowed values (see below) gets the spec's actual goal
    — more methods, still text not an enum — without any of that.
  - No-show folded into "cancelled + reason" — `no_show` is already its
    own `booking_status` enum value, with its own button, its own chip
    styling, and other code already branching on it (stats, Clientes-page
    history). Keeping it exactly as-is; the new cancellation-reason
    capture (below) is for an ACTUAL cancellation, not a no-show.
  - "Generate the invoice PDF immediately, no preview step" — this repo's
    `InvoiceConfirmModal` deliberately requires client DNI/domicilio
    (legally required on a Spanish factura) and offers the
    invoice-concepts-list picker before generating. `auto_invoice_enabled`
    already covers the "skip the modal, just generate" case once DNI/
    address are on file — that's not missing, it's an existing per-clinic
    setting. No change to invoice generation in this step at all.
  - Spanish-language stored values (`'efectivo'`, `'tarjeta'`, etc.) —
    violates this file's own English-only-code convention (CLAUDE.md "Key
    Conventions" — business type/weekday codes are English, Spanish is
    display-label-only). Store English codes, map to the spec's Spanish
    button labels for display — see the method list below.
- BUILDING:
  - Expand `kalendar_bookings.payment_method`'s check constraint from
    `('cash', 'card', 'bono')` to add `bank_transfer`, `bizum`,
    `direct_debit`, `paypal`, `other` (English codes; display labels
    TRANSFERENCIA/BIZUM/DOMICILIADO/PAYPAL/OTRO) — a `schema_subset_NNN.sql`
    + `schema_001.sql` change, same pattern as every other migration this
    session. The method list lives in a named frontend constant now (per
    the spec's own explicit ask), ready to swap for a DB-driven
    `clinic_payment_methods` table later (backlog, not this pass).
  - Cobrar becomes reachable on a FUTURE appointment too, not just past
    (the spec's actual complaint #1, and a real gap — e.g. a clinic
    collecting payment at booking time or over the phone before the
    visit). DECIDED: on a future booking, Cobrar sets
    `payment_status`/`payment_method`/`paid_at` only — it does NOT also
    set `status = 'completed'` the way past-Cobrar does, since the
    appointment hasn't happened yet. `updateBookingResult`'s existing
    optional-`status` behavior already supports this (omit `status`,
    same as the existing No-show-leaves-payment-untouched pattern) — no
    new server logic needed, just a new call site in the modal's
    non-past branch.
  - NEW: `kalendar_bookings.cancellation_reason` (text, nullable) +
    reason capture on a PAST-appointment cancel only (future-appointment
    cancel keeps today's simple confirm-dialog, per the spec). Reason
    options: No-show (pre-selected), Error de agenda, Otro (reveals a
    free-text field) — stored as entered, no new enum.
  - OPEN QUESTION, not decided by the spec or here — needs Arun's call
    before coding: today `cancelBookingAsOwner` only allows cancelling a
    booking still in `pending_confirmation`/`confirmed`
    (`lib/actions/booking-owner.ts`) — a past booking that's already been
    resolved (Cobrado → `completed`, or `no_show`) currently CANNOT be
    cancelled at all, and the spec's "Cancelar cita always visible,
    regardless of status" doesn't address what cancelling an
    already-paid/already-no-show booking should actually do: does it
    reverse a bono session deduction? What happens to an invoice already
    generated for it? Recommend scoping this step's past-cancel-with-
    reason to an UNRESOLVED past booking (time has passed, but nothing
    was ever done with it) — i.e. extending the existing guard to also
    allow `pending_confirmation`/`confirmed` bookings whose time has
    passed (no status change needed, just the time check), NOT to
    already-`completed`/`no_show` bookings. Confirm this scoping before
    building; reversing an already-resolved booking is a bigger, separate
    feature if it turns out to be needed.
  - Calendar grid: a `cancelled` (or `no_show`) booking's chip gets a
    grey background + strikethrough on the client name/service text,
    replacing today's status-color coding for those two statuses only
    (the amber/teal/rose/slate scheme in `chipClasses()`,
    `calendar-grid-view.tsx`, is otherwise untouched — this only adds a
    new visual case for an already-resolved-as-cancelled/no-show
    booking). Same treatment for both — no visual distinction between a
    future cancel and a past no-show/cancel, per the spec. Applies in
    both the per-provider and the merged multi-provider Week view
    (`DayProviderColumn`/`DayMergedColumn`).
- Explicitly UNCHANGED by this step (confirming nothing here overwrites
  earlier decisions): `pdf-invoicing.md`'s entire invoice pipeline
  (concepts list, confirm modal, auto-invoice setting, QR), bono
  session-deduction/one-directional-lock rules, the existing
  `chipClasses()` color scheme for every status other than
  cancelled/no_show, and the multi-provider calendar display work.

- IMPLEMENTED: `schema_subset_031.sql` (folded into `schema_001.sql`) —
  `payment_method` check constraint widened to add `bank_transfer`,
  `bizum`, `direct_debit`, `paypal`, `other` (English codes); new
  `cancellation_reason` text column. `lib/booking/payment-methods.ts`
  holds the frontend's `PAYMENT_METHOD_CODES` constant. Every TS type
  that mirrors the old 3-value payment-method union (`WeekBookingVM`,
  `InvoiceRow`, `PendingInvoiceBooking`, `WeekViewBooking`, the two
  inline `owner-data.ts` query types, `BookingPaymentMethod`) widened to
  match — found via a repo-wide grep for the literal union string, not
  guessed. `invoicing.ts`'s dictionary + the Facturas page's payment-
  method filter/display also got the new labels, so an invoice paid via
  one of the new methods doesn't show a bare "—".
- IMPLEMENTED: `handleCobrar` (`booking-detail-modal.tsx`) now reachable
  from a future booking too — when `isFuture`, the `updateBookingResult`
  call omits `status` entirely (the function's existing optional-status
  support), so prepaying never silently marks a future appointment
  completed. The Cobrar modal's two hardcoded buttons became a 2-column
  grid over `PAYMENT_METHOD_CODES`, with the bono option(s) kept as a
  separate full-width list below it (a bono names a specific purchase,
  doesn't fit the fixed-label grid cells).
- IMPLEMENTED, WITH A DEVIATION FROM THIS STEP'S OWN EARLIER CRITERIA:
  the past-cancel reason prompt ships with only **Error de agenda** and
  **Otro** (free text) — "No-show" was dropped from the options despite
  being listed above as "pre-selected" (copied from the spec without
  re-checking it against the rest of this step's own decision to keep
  no-show as its own status). Including it would have meant two
  different ways to reach "didn't show up" — the existing dedicated
  No-show button (sets `status = 'no_show'`) and this new path (sets
  `status = 'cancelled'`, reason = "No-show" text) — recording the same
  real-world event two different ways depending on which button was
  clicked. Dropped as redundant; **Error de agenda** is the pre-selected
  default instead. Flag for Arun to confirm this reads right once tested
  live — easy to add back if the two are meant to be genuinely distinct.
  `cancelBookingAsOwner` takes an optional `reason` param, only ever sent
  by this new flow — the existing future-appointment cancel (and the
  patient-cancellation-request approve path) keep calling it with none.
- IMPLEMENTED: `chipClasses()` (`calendar-grid-view.tsx`) — an early
  return for `status === "cancelled" || status === "no_show"`, before
  every other branch, grey (`bg-slate-200`/`text-slate-500`) +
  `line-through`. Applies in both `DayProviderColumn` and
  `DayMergedColumn` since both call the same shared function — no
  separate change needed per rendering mode.
- Still needs: Arun to run `schema_subset_031.sql` against the live DB,
  then live-test — Cobrar on a future appointment (confirm it stays
  `confirmed`/`pending_confirmation`, not auto-completed), all 7+bono
  methods selectable, the past-unresolved "Cancelar cita" reason flow
  (including whether dropping "No-show" as a reason reads right),
  cancelled/no-show chips rendering grey+strikethrough on both Day and
  Week (including the merged multi-provider view) — and the Facturas
  page correctly labels an invoice paid via one of the new methods.
  Flip to `done` once confirmed.

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
