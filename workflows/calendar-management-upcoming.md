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

## Step: multi-provider-calendar-display
Status: in_progress
Criteria (design settled 2026-10, Arun; code implemented + typechecked/
linted/built same session — PENDING MANUAL/LIVE TESTING, not yet
confirmed working by Arun):
- IMPLEMENTED: `lib/calendar/provider-filter.ts` (cookie read) +
  `lib/actions/calendar-preferences.ts` (`setCalendarProviderFilter`,
  cookie write) — `kalendar_calendar_providers` cookie, comma-separated
  member ids, empty/absent = all. Read server-side in
  `app/panel/calendar/page.tsx`, passed to `CalendarBookings` as
  `initialProviderFilter`.
- IMPLEMENTED: `components/panel/calendar-provider-filter.tsx` — the
  multi-select dropdown (checkboxes + "Todos"), rendered next to
  `CalendarHeader` only when `weekMembers.length > 1`.
- IMPLEMENTED: `calendar-bookings.tsx` derives `activeMembers`
  (filtered) and `providerFilteredBookings` (bookings scoped to the
  active selection) from `selectedProviderIds`; passes `activeMembers`
  as `CalendarGridView`'s `members` prop and the full `weekMembers` as
  its new `allMembers` prop.
- IMPLEMENTED: `calendar-grid-view.tsx` — `merged = view === "week" &&
  members.length > 1`; new `DayMergedColumn` component renders one
  provider-coded column per day (small colored dot per booking,
  `providerColorClass` indexed by position in `allMembers` so colors
  stay stable across filter changes — an 8-color palette, cycles past
  8 providers) plus a small color-key legend row above the grid. Day
  view and a Week view filtered to exactly one provider keep the
  original `DayProviderColumn` per-provider-column rendering.
- IMPLEMENTED: new-appointment provider defaulting — merged-view slot
  clicks call `handleSlotClick` with `member: null`, which sets
  `SlotSelection.teamMemberId` to `""`; `AppointmentModal`'s provider
  `<select>` shows a blank placeholder option in that case and the
  submit button/handler both now also require `teamMemberId` to be
  non-empty (previously only gated on service/date/time/conflict).
  `AppointmentModal` always receives the FULL team roster (not the
  filtered set) for its own dropdown — the filter is a view-only
  narrowing, never a hard restriction on who a booking can be made for.
- NOT yet decided (unchanged from the design pass): final visual
  treatment for provider-coded bookings — shipped as a small colored
  dot in the chip + a legend row; revisit if Arun wants something
  bolder (avatar/initial chip, border stripe) once he's seen it live.
- Still needs: Arun to test live with Bea's 2-provider clinic (and
  ideally a 3+ provider account) — Day view, Week view (all/one/a-few
  selected), the persisted-cookie behavior across reloads, and
  creating an appointment from a merged-view empty slot (provider
  field should be blank/required). Flip to `done` once confirmed.
- PROBLEM: calendar-grid-view.tsx currently renders a naive cartesian
  product for multi-provider clinics — every day column is unconditionally
  split into one sub-column per team member (`DayProviderColumn`, see
  `calendar-views` step above and `members.length > 1` branches in that
  file), with no way to narrow it down. In Week view this multiplies to
  7 days × N providers — a real clinic (Bea's, 2 providers) already shows
  as a cramped, horizontally-scrolling grid with truncated headers; it
  gets categorically worse at 3+ providers. Day view has the same
  multiplication problem on its own axis once a clinic has 5+ providers —
  always rendering every provider's column forces constant horizontal
  scrolling even though, in practice, each provider mostly just wants to
  see (and filter to) their own slots.
- DECIDED: add one provider filter, shared by Day and Week view, sitting
  alongside the existing Semana/Clientes/Cancelaciones/Conflictos tabs.
  - Multi-select (not single-select like the Facturas page's Servicio
    filter) — covers all three cases naturally: nothing selected = all
    providers (the default), one selected = just them, a few selected =
    that subset. No separate "All/One/A few" mode toggle needed, the
    selection state alone expresses all three.
  - PERSISTENT across visits (Arun's explicit call), survives
    reload/new session, not just in-memory for the current render.
    VERIFIED (2026-10): no existing filter in this codebase persists
    today — the Clientes-page filters are in-memory only (checked
    clients-manager.tsx/app/panel/clients/page.tsx, no cookie/
    localStorage there), so this isn't reusing an existing pattern, it's
    the first one. The closest real precedent is `lib/i18n/server.ts` +
    `lib/actions/locale.ts`'s `kalendar_locale` cookie (cookie-based,
    read server-side via `getLocale()`) — same shape fits here: a
    `kalendar_calendar_providers` (or similar) cookie holding the
    selected member IDs, read server-side on `/panel/calendar` so the
    grid renders already-filtered on first paint (no client-side flash of
    "all providers" before the saved filter kicks in). localStorage was
    considered and rejected — it can't be read server-side, so the first
    render would always show "all" before a client-side effect corrected
    it, which is exactly the kind of pop-in/layout-shift already flagged
    as "weird" for the Factura section earlier this same session.
- Day view: unchanged rendering shape (one side-by-side column per
  provider), just bounded by the filter — "all" (default) can still be
  wide for a big team, but the clinic can now narrow it down instead of
  being forced into it.
- Week view: when the active set (all, or a few) has more than one
  provider, MERGE into a single column per day with provider-coded
  bookings (color/badge per provider, distinct from the existing
  client-status dot/badge colors) instead of sub-columns. When the filter
  narrows to exactly one provider, Week view switches to today's
  per-provider-column rendering (there's nothing left to merge).
- New-appointment provider default (handleSlotClick in
  calendar-grid-view.tsx -> AppointmentModal's teamMemberId initial
  value): Day view and a single-provider-filtered Week view still have a
  real column to click, so those keep defaulting the modal's provider
  field to that column's owner, same as today. The merged Week view (more
  than one provider in the active set) has no per-click provider to
  default to, so the modal's existing provider `<select>`
  (`dict.providerLabel`, appointment-modal.tsx) opens UNSELECTED/blank in
  that case — the clinic must choose explicitly, never silently falls
  back to `members[0]`.
- NOT yet decided / needs a follow-up pass before coding: exact visual
  treatment for provider-coded bookings in the merged Week view (color
  swatch? left-border stripe? small avatar/initial chip?) — needs a
  mockup or at least a quick decision once this step is picked up for
  Code, not blocking the rest of the design above.

## Step: pending-guest-requests
Status: done
Criteria:
- RENAMED/REDESIGNED: the old "Pendientes" (awaiting-confirmation-only) tab was replaced by a "Clientes" tab, per Arun's decision — the real question a clinic wants answered at a glance isn't "which bookings need my confirmation" but "which reservations need a closer look, based on who's booking" (guest bookings and first-time patients warrant more scrutiny than a returning registered client)
- "Clientes" tab exists, separate from the day/week/month grid (calendar-bookings.tsx) — a flat row list (no day grouping, no calendar grid)
- ARCHITECTURE CHANGE (2026-09, part of public-booking.md's
  guest-immediate-confirm-with-clinic-followup): guests are confirmed on
  arrival now (no more pending_confirmation/24h-expiry for the normal
  flow — see that step for the full rationale/history), so this tab's
  design changed to match:
  - Data source: getClientRowBookings (lib/booking/owner-data.ts) —
    WITHOUT the starts_at >= now floor that getUpcomingBookings has, so
    this tab shows full guest history (past AND upcoming), not
    upcoming-only, per Arun's explicit decision for no-show tracking.
    Still excludes cancelled bookings. This is a genuine change from the
    tab's original upcoming-only scope.
  - Filter chips unchanged in shape — clientStatus-based (guest_unconfirmed,
    guest_confirmed, first_time now all offered as chips; "returning"
    still isn't its own chip, visible under "Todos" only) — but
    guest_unconfirmed is now the RARE case (only reachable via admin
    tooling's statusOverride, not the real public wizard); guest_confirmed
    is the common guest case now.
  - Per-row action is clientStatus-dependent, not one uniform "confirm/
    cancel": a guest_unconfirmed row (rare, statusOverride-only) still
    shows Confirm/Cancel buttons + CountdownBadge, functionally unchanged
    from before. A guest_confirmed row with clinicReviewedAt still null
    shows a single "mark reviewed" action instead (handleMarkReviewed ->
    markBookingReviewedAsOwner, lib/actions/booking-owner.ts) — sets
    clinic_reviewed_at, does NOT touch booking status (already confirmed).
    A guest_confirmed row that's already been reviewed shows no action at
    all, just the badge.
  - first_time and returning rows: unaffected by any of the above, no
    action button either way (informational only, as before).
- Reference commits: 159c05a, 6d13019 (stanize/kaminolabs-kalendar,
  2026-09-13) — same commits as public-booking.md's
  guest-immediate-confirm-with-clinic-followup, which is where the full
  design/rationale lives; this entry documents the Clientes-tab-specific
  implementation detail only, not the broader decision.

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
- Pending cancellation requests are visible to the owner in a dedicated "Cancelaciones" tab in the panel calendar, sorted soonest-requested-first (mirrors the old Pendientes tab's expiry-sort rationale — the Cancelaciones tab itself is separate from the renamed Clientes tab, see pending-guest-requests above)
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
