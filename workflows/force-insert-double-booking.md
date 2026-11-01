# Force-insert double-booking (clinic panel)

From Bea's feedback (via Arun): sometimes the clinic genuinely needs to
book a provider into an already-taken slot (e.g. a walk-in, a phone call
they can't turn away). Today that's hard-blocked (`errSlotTaken`) both by
an app-level overlap check and a DB-level unique index. This makes it a
soft warning instead — same check-then-confirm pattern already used for
Festivos/Vacaciones' existing-bookings-conflict-alert.

## Decisions (confirmed with Arun before building)

- The confirm dialog shows what's already booked in that slot (client
  name, service, time) — reuses the existing `ClosureConflictDialog`
  component and its `ConflictSummary`/`ConflictingBooking` shape.
- Applies to **both** creating a new appointment (`AppointmentModal`) and
  editing/rescheduling an existing one (`BookingDetailModal`'s inline
  Cita-tab edit).

## What changed

### DB (`schema_subset_036.sql`)

Dropped `kalendar_bookings_active_slot_idx` — the unique index on
`(business_id, team_member_id, starts_at)` that hard-blocked two active
bookings at the exact same start time. Without dropping it, confirming
"Reservar de todas formas" at the exact same start time (the most common
real case — e.g. two walk-ins both wanting 10:00) would still fail with a
raw DB error, which defeats the point of the override. The app layer now
owns this check entirely (see below) — same as every other
conflict-but-not-hard-constraint in this codebase (closures, time off).

### Server actions (`lib/actions/booking-owner.ts`)

`createBookingAsOwner` and `updateBookingAsOwner` both gained a
`confirmed?: boolean` input. When not confirmed, a real time-range overlap
query (same logic as before, not just the old exact-start-time DB check)
runs first; if it finds any pending/confirmed booking for the same
provider, the action returns
`{ ok: true; needsConfirmation: true; conflicts: ConflictSummary }`
instead of saving — mirrors `createFestivo`/`createTimeOff`'s existing
pattern exactly. The UI shows the conflict, and if the clinic confirms,
re-calls with `confirmed: true`, which skips the check and saves/updates
unconditionally.

`findOverlappingBookings` is a small shared helper (new, same file) both
actions call — builds `ConflictingBooking[]` (id, clientName, serviceName,
startIso, providerName) capped at `CONFLICT_LIST_CAP` (8, same cap as
closures).

### UI

- `components/panel/appointment-modal.tsx` and
  `components/panel/booking-detail-modal.tsx`: both now hold a `conflicts`
  state, pass `confirmed` through on retry, and render
  `<ClosureConflictDialog>` on top of the panel when `needsConfirmation`
  comes back — same as `FestivosManager`/`TimeOffList` already do.
- New `CalendarDictionary.bookingConflict` block (es/en) — same shape as
  `ClosureConflictDictionary` but worded for a booking conflict ("Horario
  ya ocupado" / "Reservar de todas formas") instead of a closure. Reusing
  the existing dialog component avoids a new one; the dict is new because
  the closure wording ("festivo", "cierre") doesn't fit here.

## Scope notes

- The slot still shows as taken in the suggested-times dropdown (amber/⚠
  styling unaffected) — this doesn't change what's *suggested*, only
  removes the hard block on *submitting* an overlapping time once the
  clinic has explicitly confirmed.
- Public booking page (patient self-service) is untouched — guests still
  can't double-book themselves; this override only exists in the two
  clinic-panel manual-booking flows.
- Doesn't touch bono session-deduction, invoicing, or reminders — a
  force-inserted booking is a completely normal booking row afterward,
  nothing downstream knows or cares that it was double-booked.

## Status

Status: in_progress — code implemented, typechecked/linted/built clean.
Pending Arun's live testing + running `schema_subset_036.sql` against the
live DB (via the admin Run-migrations tool).

Still needs testing: creating a new appointment into an already-taken
slot shows the conflict dialog with the existing booking's details, and
confirming saves both; same for editing/rescheduling an existing
appointment into another taken slot; confirming at the EXACT same start
time (the case the dropped unique index used to block) succeeds cleanly
with no DB error.
