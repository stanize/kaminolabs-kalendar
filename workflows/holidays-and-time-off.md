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
Status: not_started
Criteria:
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

## Step: provider-time-off
Status: not_started
Criteria:
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
Status: not_started
Criteria:
- `lib/booking/data.ts`'s slot-computation logic must additionally exclude:
  (a) any date matching a `recurring-public-holidays` entry (clinic-wide,
  every year), (b) any date/time range covered by a `provider-time-off`
  entry scoped to the specific provider being queried (or all providers,
  if `team_member_id` is null on the time-off row) — layered on top of the
  existing weekly-hours-minus-existing-bookings logic, not replacing it.
- Must correctly handle the "any provider" booking mode (`providerId: null`
  — used by the public wizard and the WhatsApp flow when a patient doesn't
  pick a specific provider): a day should only show as fully unavailable
  if EVERY provider is closed that day (business closure, or every
  individual provider on time off) — if even one provider is working, the
  day/slot should still show up in the "any provider" pool. Confirm this
  aggregation logic explicitly at build time against how `providerId: null`
  currently aggregates across `kalendar_team_members`.
- Applies identically to the public booking page, the panel's manual
  booking modal (`appointment-modal.tsx`), and the WhatsApp bot's date/time
  listing (`lib/whatsapp/conversation.ts`) — all three already share the
  same underlying `getAvailableSlots`/`getPublicBookingData` functions per
  earlier features in this codebase, so a single fix at the data layer
  should cover all three call sites without touching each individually
  (confirm this holds at build time rather than assuming).

## Step: existing-bookings-conflict-alert
Status: not_started
Criteria:
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
