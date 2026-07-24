# Appointment Reminders — Build Log

Tracks the appointment-reminders feature build (backlog #1) turn by turn, so
progress and decisions are visible at any point without re-deriving them from
the diff. Source spec: `kalendar-appointment-reminders-spec.md` (provided by
Arun, not committed to the repo — kept here as the reference of record instead).

---

## Decisions locked in (session start)

1. **Reminder windows**: fixed at 24h and 1h before `starts_at` for v1. Not
   configurable per business.
2. **Cron cadence**: every 15 minutes (`*/15 * * * *`), matching the ±15min
   send-windows around each target so no booking is missed to cron jitter.
3. **Failure visibility (§7 of spec)**: shipping in the same PR as the core
   reminder logic, not deferred — cheap now, expensive to retrofit.

## Plan (order of work)

- [x] 1. Schema: added `reminder_24h_sent_at`, `reminder_1h_sent_at`,
      `reminder_send_failed`, `last_reminder_error` columns to
      `kalendar_bookings` in `schema_001.sql`, plus
      `kalendar_bookings_reminder_due_idx` partial index. Applied live via
      Supabase MCP (`apply_migration`, migration name
      `add_appointment_reminder_tracking_columns`) — confirmed success.
- [x] 2. Email templates: `appointmentReminder24hEmailHtml` /
      `appointmentReminder1hEmailHtml` / `reminderEmailSubject` added to
      `lib/email.ts`, following the existing branded-shell + inline-locale
      pattern (see deviation note above). Reuses `formatBusinessAddress()`
      from `lib/business/data.ts` (existing shared formatter, also used by
      confirmation emails + ICS) for the address row — not reinvented.
- [ ] 3. i18n: N/A per the deviation note — reminder copy is inline in
      `lib/email.ts`, not a dictionary file.
- [x] 4. Cron route: `app/api/cron/send-reminders/route.ts` — modeled on
      `sweep-expired-bookings/route.ts`. Queries the 24h and 1h windows in
      parallel, re-checks `status = 'confirmed'` at send time (not just query
      time), sets the `_sent_at` column only after a successful send, and
      records `reminder_send_failed` / `last_reminder_error` on failure
      (cleared on a later successful retry).
- [x] 5. GitHub Actions workflow: `.github/workflows/reminders-cron.yml` —
      `*/15 * * * *` + `workflow_dispatch`, same shape as `sweep-cron.yml`,
      hits `/api/cron/send-reminders` with the same `CRON_SECRET` bearer auth.
- [x] 6. Failure visibility: `reminder_send_failed` / `last_reminder_error`
      threaded end-to-end — `owner-data.ts` (`WeekViewBooking`) →
      `app/panel/calendar/page.tsx` mapping → `WeekBookingVM`
      (`calendar-grid-view.tsx`) → small amber ⚠ marker on the week-grid chip
      + a labeled row (with the error as a tooltip) in
      `booking-detail-modal.tsx`. Scoped as a visibility addition only, no
      new notification system, per spec §7.
- [x] 7. Validation: `npx tsc --noEmit` clean; `npx eslint` clean on all
      changed files. (One knock-on fix needed: `app/panel/calendar/page.tsx`
      builds `weekInitialBookings` from `WeekViewBooking` by hand-mapping
      fields — had to add the two new fields there too, tsc caught it
      immediately.)
- [ ] 8. Push (single commit via `/tmp/gitpush.py`).
- [ ] 9. Manual verification per spec §8 (test booking ~24h/~1h out, run cron
      via `workflow_dispatch`, confirm idempotency, confirm `pending_confirmation`
      and post-cancellation exclusion).

## Files changed this session

- `supabase/schema_001.sql` — reminder columns + partial index
- `lib/email.ts` — two reminder templates + subject helper
- `app/api/cron/send-reminders/route.ts` — new cron route
- `.github/workflows/reminders-cron.yml` — new workflow
- `lib/booking/owner-data.ts` — reminder fields in `WeekViewBooking`
- `components/panel/calendar-grid-view.tsx` — `WeekBookingVM` fields + chip marker
- `components/panel/booking-detail-modal.tsx` — failure notice row
- `app/panel/calendar/page.tsx` — thread fields through to the client component
- `docs/reminders-build-log.md` — this file (new)

## Notes / deviations from spec as written

- **§6 i18n placement**: spec suggested adding reminder subject/body strings
  to a `lib/i18n/dictionaries/*` file. Checked the actual convention: every
  existing email builder in `lib/email.ts` (`bookingConfirmEmailHtml`,
  `bookingCancelledClientHtml`, etc.) keeps its own inline
  `locale === "en" ? {...} : {...}` copy object — the dictionary system is
  reserved for on-page UI strings, not email copy. Following that established
  pattern instead: reminder copy lives inline in the two new builder
  functions, matching every other guest-facing email.

## Status

**Not started — plan above is the current state.**
