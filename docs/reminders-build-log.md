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

**Core reminders feature: built, deployed, verified working** (24h + 1h
emails both confirmed via live test sends; pending-confirmation exclusion
confirmed). See "Cron cadence finding" below for an open infra question.

## Mid-session addition: EMAIL_LOCALE pin (2026-07-25)

After reviewing a live test email, Arun asked to stop deriving guest-facing
email language from the booking's `guest_locale` and default everything to
Spanish instead, until a deliberate `business.language` field exists.

- **Scope confirmed**: all guest-facing emails, not just reminders —
  confirmation, cancellation (client + expiry-sweep), under-review, and both
  reminder emails.
- **guest_locale itself**: left untouched in the DB and booking wizard —
  still detected and stored on every booking as before. Only the *email*
  call sites stopped reading it.
- **Implementation**: added `export const EMAIL_LOCALE: "es" | "en" = "es"`
  to `lib/email.ts` as the single source of truth, with a comment pointing
  at this log entry and at what to do once `business.language` lands (swap
  the constant for that per-business value at each call site). Every call
  site that previously computed a `guestLocale` variable from
  `booking.guest_locale` *for email purposes* now uses `EMAIL_LOCALE`
  instead:
  - `lib/actions/booking.ts`: `bookGuestSlot`'s confirm/under-review send,
    and `notifyCancellation`'s client receipt.
  - `lib/actions/booking-owner.ts`: the owner-confirms-pending-booking send.
  - `app/api/cron/send-reminders/route.ts`: both reminder variants.
  - `app/api/cron/sweep-expired-bookings/route.ts`: the expiry-cancellation
    guest email.
- **Explicitly NOT touched**: `getBookingByToken`'s `guestLocale` return
  value in `lib/actions/booking.ts` — that drives the guest-facing *cancel
  page* UI (on-page i18n), not an email, and is out of scope for this ask.
- Validated: `tsc --noEmit` and `eslint` both clean across all five touched
  files after this change.

## Cron cadence finding (2026-07-25) — needs a decision, not yet acted on

Live testing surfaced a real infra gap, not a bug in the reminders code
itself: `reminders-cron.yml` is scheduled `*/15 * * * *`, but the actual
GitHub Actions run history showed gaps of **1h50m to 3h11m** between runs
(cross-checked against `sweep-cron.yml`'s long-running history, which shows
the same kind of jitter against its own hourly schedule — e.g. one real gap
of ~1h45m). GitHub does not guarantee scheduled-workflow timing, especially
under load, and this repo's actual cadence today is far looser than 15
minutes.

Practical effect: the reminder windows (±15min around the 24h/1h marks) are
narrow enough that many real reminders could be missed entirely if a cron
run doesn't land inside the open window — this isn't hypothetical, it's what
happened to the first two test bookings before the schedule "warmed up."

**Not decided yet — flagging for a future session:**
1. Widen the send-windows (trades timing precision for reliability — e.g. a
   "24h before" reminder that actually goes out 22–26h before is still
   useful; a "1h before" reminder with a wide window is riskier since it can
   fire late).
2. Move off GitHub Actions schedule for this specific job (e.g. an external
   cron service like cron-job.org hitting the same authenticated endpoint,
   or a paid Vercel plan's native Cron).
3. Accept the current jitter for v1 and revisit if it proves to be a real
   no-show-reduction problem in practice.

This is a genuine trade-off decision, not something to silently patch —
noting it here rather than picking an approach unilaterally.
