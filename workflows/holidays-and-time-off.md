# Workflow: Holidays & Time Off

Public holidays (festivos) and per-provider time off (vacations, absences),
layered on top of the existing `kalendar_business_hours` weekly schedule.
Originated from a feature request (2026-09-25) ahead of a client demo/sale;
this file is Design-only until the steps below are actually built — no code
has been written for this feature yet.

**Critical existing-architecture finding (2026-09-25, verified against
code)**: today there is NO per-provider schedule concept at all.
`kalendar_business_hours` is business-wide only; `kalendar_team_members` has
no hours of its own. The public booking engine (`lib/booking/data.ts`) uses
`team_member_id` purely to check existing-booking conflicts, never to vary
working hours — every provider is assumed to share the one business-wide
schedule. "Personal holidays per provider" is therefore the FIRST
per-provider dimension this engine will have, not just a new table bolted
onto an existing per-provider layer.

## Step: recurring-public-holidays
Status: in_progress
Criteria:
- BUILT (2026-09-25): code implemented, typechecked (`npx tsc --noEmit`
  clean), linted (`npx eslint` clean) and `npm run build` succeeds. Pending
  Arun's live testing before this flips to `done`.
- Table: `kalendar_business_closures` (shared with `provider-time-off` below
  — see that step's note), folded into `supabase/schema_001.sql` and added
  standalone via `supabase/schema_subset_016.sql` (Arun still needs to run
  this against the live DB).
- Actions (`lib/actions/closures.ts`, `authedAction`-wrapped, business-scoped
  via `getBusinessForUser`): `createFestivo({ month, day, label })`,
  `deleteClosure({ id })` (shared with time off). Reads via
  `getClosuresForUser(userId)` in `lib/closures/data.ts`.
- UI: "Festivos" section (`components/panel/festivos-manager.tsx`) rendered
  on `/panel/availability` below the existing weekly-hours editor —
  day/month pickers + optional name, add/list/delete, immediate commit per
  action (no batch save, unlike the weekly-hours grid). Spanish copy in
  `lib/i18n/dictionaries/festivos.ts`.
- DECISION (2026-09-25, Arun): clinic-wide, entered as `month + day` (no
  year) — a fixed date that auto-repeats every year with zero re-entry
  (e.g. "25 December" closes every Dec 25 going forward). Covers the
  common case (fixed national holidays) without any yearly maintenance.
- DECISION (2026-09-25, Arun): manual entry only, no auto-populated Spain
  national-holiday calendar for v1. Reasoning on record: avoids an
  external-data dependency or a yearly-maintained static dataset, and
  clinics differ on which regional/local (autonomous-community, municipal
  fiesta) holidays they actually observe anyway — the clinic knows its own
  closures better than a generic national list would. Revisit
  auto-populate as a later onboarding-polish item if it comes up again,
  not now.
- Movable/year-specific holidays (a local fiesta that shifts date each
  year, Easter-linked dates, etc.) are NOT covered by the recurring
  month+day model — those need a one-off dated entry instead. Model this
  as a single `kalendar_business_closures`-shaped table (name TBD at build
  time) with a `recurring: boolean` flag: `recurring = true` rows store
  only month+day and apply every year; `recurring = false` rows store a
  full date and apply once. Both row shapes live in the same table so the
  UI and the availability-lookup query stay simple (one source to check,
  not two).
- Settings UI: new section, most likely alongside the existing weekly-hours
  editor at `/panel/availability` (confirm exact current route/component at
  build time) — "Festivos" list with add/remove, each entry either a fixed
  annual date or a specific one-off date.
- **Follow-up (2026-09-26, Arun tested live): editing added, not just
  add/delete.** New `updateFestivo({ id, month, day, label, confirmed?,
  dict? })` in `lib/actions/closures.ts` — `authedAction`-wrapped, scoped to
  the caller's own business, validated the same way `createFestivo` is
  (month/day range, label length), and re-verifies the row both belongs to
  the business AND is a recurring closure before touching it. Goes through
  the SAME check-then-confirm conflict flow as create (`findConflictingBookings`
  against the NEW day/month being saved, `needsConfirmation`/`conflicts`
  shape, same `ClosureConflictDialog`) — an edit that would newly overlap
  existing bookings is gated exactly like a create, per this task's explicit
  instruction not to skip that check just because it's an edit.
  - UI (`components/panel/festivos-manager.tsx`): clicking a new pencil icon
    next to an existing festivo's delete button swaps that row for an
    inline edit form (day/month/label selects, pre-filled, styled with a
    `brand-weak` background to stand out) — reuses the same input markup as
    the add form, not a separate modal. "Guardar cambios" saves (routes
    through `updateFestivo`); an X button cancels back to the static row.
    Only one row editable at a time (`editingId` state).
  - `pendingConfirm` (`{ kind: "add" } | { kind: "edit"; id }`) tracks which
    save the conflict dialog's "Guardar de todas formas" should retry, since
    add and edit now share one dialog instance.
  - New dictionary fields (`lib/i18n/dictionaries/festivos.ts`): `edit`
    (aria-label), `saveEdit`, `cancelEdit` (aria-label), es+en.

## Step: provider-time-off
Status: in_progress
Criteria:
- BUILT (2026-09-25): code implemented, typechecked, linted, build passes
  (same validation run as `recurring-public-holidays`, same commit). Pending
  Arun's live testing before this flips to `done`.
- Same table as `recurring-public-holidays` (`kalendar_business_closures`,
  `recurring = false` rows here, `team_member_id` nullable — null =
  clinic-wide one-off, set = scoped to that provider).
- Actions (`lib/actions/closures.ts`): `createTimeOff({ teamMemberId,
  startDate, endDate, startTime?, endTime?, label })` — validates the date
  range, restricts the optional partial-hours window to a single-day entry
  (v1 scope per this file's DECISION above), and verifies a passed
  `teamMemberId` belongs to the caller's own business before inserting.
  Deletes share `deleteClosure({ id })` with the festivos step.
- **RELOCATED (2026-09-26, Arun):** originally wired into `TeamManager`
  on `/panel/team`; moved to `/panel/availability` instead (new
  `components/panel/provider-time-off-manager.tsx`, replacing the
  team-page attachment) so everything schedule-related — weekly hours,
  festivos, and per-provider time off — is managed in one place. Equipo
  (`/panel/team`) goes back to being roster-only (add/rename/remove
  members), no longer fetches or renders any closures data.
  `TimeOffDictionary` gained `title`/`subtitle` fields for the new
  section's own heading, matching `FestivosDictionary`'s existing pattern.
  Functionally unchanged otherwise — same `TimeOffList` component, same
  data/actions, just a different page and a name-only (not inline-
  editable) list of members to expand.
- UI: per-team-member "Vacaciones / ausencias" expandable section
  (`components/panel/time-off-list.tsx`), with add/list/delete, immediate
  commit per action. Renders identically for the owner's
  own row in a solo business — no separate solo-only path, since a solo
  owner is still a real `kalendar_team_members` row (matches the workflow
  doc's framing that clinic-wide festivos cover the no-configuration case,
  not that per-provider time off is hidden for solo). Spanish copy in
  `lib/i18n/dictionaries/time-off.ts`.
- DECISION (2026-09-25, Arun): per-provider, nullable scope — a time-off
  entry with `team_member_id = null` applies clinic-wide (equivalent to a
  one-off closure, distinct from the recurring festivos above only in that
  it's a single dated range rather than an annually-repeating date);
  `team_member_id` set applies to just that provider. For a solo clinic
  (one provider), the clinic-wide closures above already cover them — no
  separate per-provider configuration is forced on a single-provider
  business, matching Arun's "for solo clinics, the default can be used"
  framing.
- Granularity, DECIDED (2026-09-25, Arun — "both, eventually", phased):
  - **v1 (this step)**: one-off entries only, either a full-day (or
    multi-day/week) date range, OR a same-day partial-hours range (start
    time + end time on one date) — same table, just optional time fields:
    null start/end time = full day(s); both set = a partial-day window on
    that single date. A multi-day range with partial hours on each day is
    NOT supported in v1 (out of scope) — a vacation is a date range, a
    partial absence is a single date + time window; combining both is a
    real but rarer case, deliberately deferred.
  - **v2 (future, NOT this pass)**: a recurring weekly pattern (e.g. "this
    provider never works Wednesday afternoons, every week") is a
    fundamentally different thing — a per-provider BASE SCHEDULE override,
    not a time-off exception. This needs its own table mirroring
    `kalendar_business_hours`'s shape but scoped to `team_member_id`
    (overriding, not just supplementing, the business-wide hours for that
    provider on the days it has rows). Explicitly out of scope for this
    pass; noted here so a future session doesn't have to re-derive the
    distinction between "recurring schedule override" and "one-off time
    off" — they are NOT the same feature even though both were mentioned
    in the same original request.
- Settings UI: likely per-provider, on the Equipo (`/panel/team`) page or a
  provider-specific sub-view, rather than the shared `/panel/availability`
  page — confirm exact placement at build time; a time-off list scoped to
  "this provider" reads more naturally attached to their team-member
  record than mixed into the clinic-wide hours editor.

## Step: availability-engine-integration
Status: in_progress
Criteria:
- BUILT (2026-09-26): code implemented, typechecked (`npx tsc --noEmit`
  clean), linted (`npx eslint` clean) and `npm run build` succeeds. Pending
  Arun's live testing before this flips to `done`.
- **Confirmed consuming surfaces**: `getAvailableSlots` in
  `lib/actions/booking.ts` is the ONE shared slot-computation entry point —
  it's what both the public website wizard (`components/booking/booking-wizard.tsx`)
  and the WhatsApp bot (`lib/whatsapp/conversation.ts`) call to list
  bookable times; both were verified by grepping their imports before
  changing anything. The panel's manual booking modal
  (`components/panel/appointment-modal.tsx`) was ALSO checked and does NOT
  call `getAvailableSlots`/`getPublicBookingData`/`generateSlotsForDay` at
  all — it has its own client-side `isTimeTaken` conflict check against the
  bookings already loaded into the calendar week view, entirely separate
  from this engine. So this change reaches exactly the two public-facing
  surfaces and cannot touch the manual modal's behavior even incidentally.
- **What changed**: `getAvailableSlots` now fetches the business's closures
  (`getClosuresForBusiness`, new in `lib/closures/data.ts` — a
  business-id-scoped read, since this is a public/unauthenticated code path
  with no user to scope by; same trust level as the other public queries in
  `getPublicBookingData`) and expands them into concrete UTC windows via
  `closureDateWindows` (reused as-is from `lib/closures/conflicts.ts`,
  exported for this — no second "is this date closed" implementation).
  Each window is then treated exactly like an existing booking: appended to
  the `taken` interval list passed into `generateSlotsForDay`, so a closed
  slot is excluded by the same overlap check that already excludes a
  booked one. `toClosureInput` (`lib/closures/conflicts.ts`) was exported
  (was previously private) so this reuses the exact same
  BusinessClosure -> ClosureInput mapping the conflict-check/Conflictos-tab
  code already uses.
- **Recurring festivos**: `closureDateWindows` already expands a recurring
  month+day closure into one window per year from now through a passed
  `horizonEnd`; `getAvailableSlots` passes its own already-computed `to`
  (the end of the queried date range, which is exactly the concrete window
  a slot search ever needs) as that horizon — no new expansion logic
  needed, no change to `closureDateWindows` itself.
- **"Any provider" aggregation — confirmed correct by tracing the existing
  code, not just assumed**: `getAvailableSlots`'s `providerId: null` path
  already worked by computing each team member's own slots independently
  (their own taken-intervals fetch + their own `generateSlotsForDay` call)
  and then unioning the results into one labelled list. Closure exclusion
  was added at exactly that same per-member step — each member's own
  `taken` list gets that member's applicable closures appended (clinic-wide
  closures, `team_member_id = null`, apply to every member; a
  provider-scoped closure only appends to that one member's list) BEFORE
  their own `generateSlotsForDay` call runs. Because the union across
  members happens one level higher (unchanged), a member who is fully
  closed for a given slot simply contributes nothing to that slot from
  their own call, while any other member not covered by a closure still
  contributes normally — the pool is only empty when EVERY member's own
  call excludes it. No separate "is everyone closed" aggregation step was
  written or needed; reusing the existing per-member-then-union shape gets
  this right by construction.
- **Solo businesses**: `getPublicBookingData` only populates `members` for
  team-mode businesses, so there's no member id available to match a
  closure's `team_member_id` against in the solo path. Since a solo
  business has exactly one provider (the owner's own single
  `kalendar_team_members` row) either way, ANY closure — clinic-wide or one
  scoped to a specific team_member_id — necessarily applies to that one
  provider; there is no other provider it could be scoped away from. So the
  solo path treats every closure as applicable regardless of its
  `team_member_id`, rather than adding a second query just to resolve the
  owner's own row id for a comparison that couldn't come out differently.
- **DECISION + reasoning (2026-09-26, confirmed against actual code, not
  just assumed): the panel's manual booking modal keeps its full override
  and was NOT touched.** As found above, `appointment-modal.tsx` never
  calls the shared availability engine at all — it doesn't even read
  closures — so there was nothing to "carve out" a manual-override path
  from; the modal's submit path was already, and remains, completely
  independent of this change. This matches the framing already established
  by this workflow file's earlier steps and by this codebase's existing
  pattern elsewhere in the same modal (it already lets the clinic book into
  a past date or outside business hours — both are shown as a warning, not
  blocked): closures are a PATIENT-facing availability rule, not a hard
  scheduling constraint, and the clinic retains full manual authority over
  its own calendar (e.g. a walk-in on a day marked closed, or a provider on
  vacation who comes in anyway). Suggested-times dropdowns in the panel, if
  ever wired to `getAvailableSlots` in the future, would legitimately omit
  closed times as a suggestion without that constituting a hard block,
  since the modal's actual save action doesn't gate on that list — but as
  of this build the modal doesn't call it at all, so this is documented for
  a future reader rather than something exercised today.
- No schema change — reuses `kalendar_business_closures` exactly as it
  already exists from `recurring-public-holidays`/`provider-time-off`.
- **Follow-up (2026-09-26, Arun tested live): public page now names the
  festivo on a closed day.** `getAvailableSlots` returns a new sibling field,
  `festivoByDate: Record<string, string | null>` ("YYYY-MM-DD" -> the
  recurring festivo's own label, or `null` when it has none) alongside
  `slotsByDate`. Built by a new `festivoLabelsForRange` helper
  (`lib/closures/conflicts.ts`), filtered to `recurring === true` closures
  only and reusing the exact same `closureDateWindows` yearly expansion
  already used for slot-exclusion and the conflict checks — no second
  "does this date match a festivo" implementation. A one-off provider
  vacation/time-off is NEVER in this map, matching Arun's explicit "vacations
  should show as not available as others" — those dates keep the fully
  generic messaging.
  - Threaded through `booking-wizard.tsx`'s `DateTimeStep` (new
    `festivoByDate` state, set alongside `slotsByDate` from the action's
    result) and used ONLY in the `sel && slots?.length === 0` branch (the
    `!sel` "Cerrado" branch is for non-open weekdays by the regular
    schedule, which a date-specific festivo can't cause — verified this is
    the branch that actually fires for a festivo day before wiring it in,
    per this task's own instruction to check rather than guess).
  - Copy: `w.closedFestivoTemplate` ("Cerrado — {name}" / "Closed — {name}")
    replaces `w.noSlotsThisDay` for a festivo date; `{name}` is the
    festivo's label, or `w.festivoFallbackLabel` ("Festivo"/"Holiday") when
    it has none. New strings in `lib/i18n/dictionaries/booking-page.ts`
    (`wizard.closedFestivoTemplate`, `wizard.festivoFallbackLabel`), es+en.

## Step: existing-bookings-conflict-alert
Status: in_progress
Criteria:
- BUILT (2026-09-26): code implemented, typechecked (`npx tsc --noEmit`
  clean), linted (`npx eslint` clean) and `npm run build` succeeds. Pending
  Arun's live testing before this flips to `done`.
- Shared overlap-detection helper: `lib/closures/conflicts.ts` —
  `findConflictingBookings(businessId, closure, horizonEnd)` expands a
  closure definition (recurring festivo or one-off/provider time off) into
  its concrete UTC date/time window(s) and queries
  `pending_confirmation`/`confirmed` `kalendar_bookings` overlapping them,
  provider-scoped when the closure is. Used by BOTH this step and the new
  `conflicts-tab` step below, so "does this booking fall inside this
  closure" has one implementation.
- Recurring-festivo scoping (Arun's explicit decision): checked only across
  years from now through the business's `booking_window_months` horizon —
  never further out, since nothing can be booked beyond that anyway.
  One-off time off/closures check only their own real date range (and
  provider, if scoped).
- Check-then-confirm flow: `createFestivo`/`createTimeOff`
  (`lib/actions/closures.ts`) take an optional `confirmed?: boolean`
  (default false/omitted). First call with `confirmed` unset runs the
  conflict check; if conflicts exist, returns
  `{ ok: true, needsConfirmation: true, conflicts: { total, sample } }`
  WITHOUT inserting. The UI (`FestivosManager`/`TimeOffList`) shows
  `components/panel/closure-conflict-dialog.tsx` (shared between both) —
  "⚠️ N citas se ven afectadas" + up to **8** affected bookings (client,
  service, date/time), "+N more" beyond that cap — and only inserts once
  the clinic clicks "Guardar de todas formas" (re-calls with
  `confirmed: true`). Zero conflicts on the first call saves straight
  through, no dialog. No stored conflict state, no bulk action on the
  affected bookings — purely a save gate, per the original decision.
- Shared dictionary: `lib/i18n/dictionaries/closure-conflict.ts`
  (`ClosureConflictDictionary`), threaded through both
  `/panel/availability` (Festivos) and `/panel/team` → `TeamManager` →
  `TimeOffList` pages.
- DECISION (2026-09-25, Arun): "alert only, no automatic action." When the
  clinic saves a new closure/time-off entry that overlaps one or more
  existing `pending_confirmation`/`confirmed` bookings, show a confirmation
  dialog listing the affected appointments (patient name, date/time,
  service) before the closure actually saves. The clinic must explicitly
  confirm ("I understand, save anyway") to proceed.
- Explicitly NOT building bulk-cancel/reschedule tooling as part of this
  alert (considered and declined — Arun's call, keeps this pass scoped).
  Affected appointments are left completely untouched after the alert is
  confirmed; the clinic follows up manually (call/message the patient,
  cancel or reschedule by hand via the existing calendar UI) — same
  pattern as other places in this app where a config change doesn't
  cascade automatically to existing bookings (e.g. deleting a service
  doesn't touch bookings that already reference it).
- Query needed: given a proposed closure's date range (and, for
  provider-scoped time off, a specific `team_member_id`), find overlapping
  `kalendar_bookings` rows with `status in ('pending_confirmation',
  'confirmed')` whose `starts_at` falls within the closure's range (and,
  for a partial-day closure, within the specific time window too).

## Step: conflicts-tab
Status: in_progress
Criteria:
- BUILT (2026-09-26), same commit/validation as `existing-bookings-conflict-alert`
  above. Pending Arun's live testing before this flips to `done`. Added
  mid-session (2026-09-26 follow-up, not in the original design pass) —
  Arun asked for a persistent, always-checkable view of conflicts, not just
  a one-time save-time alert.
- New "Conflictos" tab on `/panel/calendar`
  (`components/panel/calendar-bookings.tsx`), alongside the existing
  Semana/Clientes/Cancelaciones tabs.
- LIVE/DERIVED, not stored: no flag is written when the alert above is
  confirmed. Every tab open (and after any Cancelar/Modificar action taken
  from it) refetches fresh via the `fetchConflictingBookings` server
  action (`lib/actions/booking-owner.ts`) →
  `getConflictingBookingsForUser` (`lib/booking/owner-data.ts`), which
  loads the business's closures and calls the SAME
  `lib/closures/conflicts.ts` overlap helper used by the pre-save check
  above (`getCurrentConflicts`), then hydrates the matched booking ids into
  full `WeekViewBooking` rows (so the existing `BookingDetailModal`/
  `AppointmentModal` can be reused unmodified).
- Each row shows patient name, date/time, service, and which closure it
  matches — "Coincide con: {closure label}" (`conflictMatchesTemplate` in
  `lib/i18n/dictionaries/calendar.ts`); a provider-scoped time-off entry
  without a custom label falls back to "Vacaciones de {provider}"
  (`closureDisplayLabel` in conflicts.ts), a recurring festivo without a
  label falls back to its day/month, everything else falls back to
  "Cierre".
- Two actions per row, both reusing existing plumbing: **Cancelar** →
  `cancelBookingAsOwner` directly (optimistic removal from the tab's local
  list + refetch); **Modificar** → opens the same `AppointmentModal`
  instance the other tabs already share, in edit mode.
- Refresh convention: matches Cancelaciones's existing
  optimistic-removal/refetch pattern. `refreshConflicts()` (refetches via
  `fetchConflictingBookings`) is called on tab-open AND from
  `handleGridBookingCreated` (the same handler `AppointmentModal`'s
  `onSaved` and the grid's `onBookingCreated` already call) — a save from
  ANY tab can create or resolve a conflict, so the Conflictos list is kept
  in sync regardless of which tab triggered the change, not just when
  opened from Conflictos itself.
- Empty state matches the existing Clientes/Cancelaciones tabs' style
  (`emptyConflictsTitle` + shared `emptySubtitle`); a distinct
  `loadingConflicts` string shows while the first fetch for a tab-open is
  in flight.
- No schema change — reuses `kalendar_business_closures` and
  `kalendar_bookings` exactly as they already exist.
- **Follow-up (2026-09-26, Arun tested live): festivo day columns now get a
  visual treatment on `/panel/calendar`.** `GridDay`
  (`components/panel/calendar-grid-view.tsx`) gained `isFestivo: boolean` +
  `festivoLabel: string | null`; `buildGridDays` takes a new optional
  `festivos: GridDayFestivo[]` param (`{ month, day, label }`, matched
  directly against each day's own month/day — no year/window math needed
  here, unlike the conflict-check/public-page uses of `closureDateWindows`,
  since a recurring festivo's month+day pattern applies to any year by
  definition). Recurring, clinic-wide festivos ONLY — a one-off provider
  vacation/time-off never sets `isFestivo`, matching every other place this
  distinction is enforced in this feature; that stays visible only via the
  Conflictos tab, unchanged.
  - Fetched once at the page level (`app/panel/calendar/page.tsx`, via the
    existing `getClosuresForUser`, filtered to `recurring`) and passed down
    through `CalendarBookings` as a new `festivos` prop, since week/day
    navigation happens client-side (`buildGridDays` re-called locally, no
    refetch per week) — a plain month/day list works for any week/date the
    clinic navigates to without re-fetching.
  - Visual: a `pointer-events-none absolute inset-0 bg-amber-50/60` wash
    over the whole day column, same layering technique as the existing
    `isPast` wash right above it in `DayProviderColumn` (non-interactive,
    doesn't block clicking to add a walk-in booking) — reuses the same
    amber family `chipClasses` already uses for a "needs clinic follow-up"
    booking (`bg-amber-50 text-amber-900 border-l-4 border-amber-500`), per
    Arun's ask that this "look similar to the pending color."
  - Label: `(festivo name)` rendered under the day's `dateLabel` in the
    column header, e.g. "lun 15" / "(Navidad)" — falls back to
    `dict.week.festivoFallbackLabel` ("Festivo"/"Holiday") when the closure
    has no custom label. New dictionary field in
    `lib/i18n/dictionaries/calendar.ts` (`week.festivoFallbackLabel`), es+en.

## Notes / Deviations
- Two genuinely separate features got requested together and must stay
  conceptually separate at build time, per `provider-time-off`'s v1/v2
  split above: (1) one-off time off / vacations (exceptions layered on top
  of the existing schedule) vs. (2) a recurring per-provider base-schedule
  override (a new first-class scheduling layer). Only (1) is in scope for
  this design pass; (2) is explicitly deferred, not forgotten.
- No schema has been written yet — this file is Design-only per Arun's
  explicit instruction ("coding can start once we agree on the final
  design"). Next step, once Arun reviews/confirms this design, is picking
  up `recurring-public-holidays` and `provider-time-off` as the first two
  real build steps (they can likely be built together, sharing one
  closures/time-off table with a nullable `team_member_id` and a
  `recurring` flag, per the schema sketch in each step above), followed by
  `availability-engine-integration`, then
  `existing-bookings-conflict-alert`.
