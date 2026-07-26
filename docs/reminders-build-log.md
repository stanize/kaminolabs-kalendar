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

## Cron cadence: resolved (2026-07-25) — moved to Supabase pg_cron

Decision made: primary scheduling moved from GitHub Actions to **Supabase
`pg_cron` + `pg_net`**, keeping GitHub Actions as a documented manual
fallback rather than removing it.

**Why this option**: already in the stack (no new vendor), runs inside
Supabase's own Postgres instance rather than a shared external scheduler
queue, supports down-to-the-minute scheduling, and ties dependability to
Supabase's own uptime rather than GitHub Actions' best-effort Actions
scheduler (which is what produced the 1h50m–3h11m gaps documented above).

**What was done:**
- Enabled `pg_cron` and `pg_net` extensions on the Supabase project
  (`supabase_vault` was already enabled). Migration:
  `enable_pg_cron_and_pg_net`.
- Rotated `CRON_SECRET` (old value retired) and stored the new value in
  Supabase Vault as secret name `cron_secret`, rather than embedding it in
  plain SQL — referenced via `vault.decrypted_secrets` inside the cron job
  body.
- Created a `cron.schedule` job named `send-appointment-reminders`,
  `*/15 * * * *`, that does a `net.http_get` against
  `https://kalendar.kaminolabs.dev/api/cron/send-reminders` with the
  vault-stored secret as the `Authorization: Bearer` header. Migration:
  `schedule_appointment_reminders_pg_cron`. Confirmed registered via
  `select * from cron.job` (jobid 1, active).
- `.github/workflows/reminders-cron.yml` — removed the `schedule:` trigger,
  kept `workflow_dispatch:` only. Renamed the workflow to "Send appointment
  reminders (fallback)" with a comment block explaining it's now
  manual-only, why, and that it's safe to run alongside pg_cron because
  reminder sending is idempotent (the `_sent_at` column guards).
- `app/api/cron/sweep-expired-bookings/route.ts` / `sweep-cron.yml` —
  **left as-is**, out of scope for this change (only the reminders job moved;
  the sweep job shares the same `CRON_SECRET`, so it's affected by the
  rotation below but not by the scheduler change itself).

**Manual steps Claude could not complete (tooling gaps, not skipped):**
1. **Vercel**: update the `CRON_SECRET` environment variable to the new
   rotated value, then redeploy so the running app picks it up. No
   env-var-write tool is available in this session's Vercel MCP tools
   (only observability + docs + design-import tools were available).
2. **GitHub**: update the repo secret `CRON_SECRET` (Settings → Secrets and
   variables → Actions) to the same new value, so the fallback workflow
   still authenticates correctly if it's ever run manually. The GitHub PAT
   in use has Contents:write (pushes work) but not Actions:write/secrets
   permission — same gap hit earlier when trying `workflow_dispatch` via API.

Both of these use **the same new secret value**, supplied to Arun directly
in chat (not restated here since this file may end up in a public repo).

## Final verification (2026-07-26) — Supabase pg_cron path confirmed working

After Arun updated both the Vercel `CRON_SECRET` env var and the GitHub
Actions repo secret to the rotated value, and Vercel redeployed commit
`0a6b447` (confirmed `READY` via `Vercel:list_deployments`), re-ran the full
test:

- `cron.job_run_details` for `send-appointment-reminders` shows runs landing
  exactly on `:00/:15/:30/:45` — **zero jitter**, a direct contrast to the
  1h50m–3h11m gaps observed on GitHub Actions. This is the reliability
  improvement the migration was for.
- Fresh 24h + 1h test bookings (`stanize@gmail.com`) both got
  `reminder_24h_sent_at` / `reminder_1h_sent_at` set on the same `12:15:03`
  run, and Arun confirmed both emails arrived (in Spanish, per the
  `EMAIL_LOCALE` pin).
- The `pending_confirmation` exclusion test booking had independently
  transitioned to `cancelled` (via the existing expiry sweep) by the time of
  this run — still validates the intended behavior: a non-`confirmed`
  booking gets no reminder, both `_sent_at` columns stayed `null`.
- `reminder_send_failed` stayed `false` / `last_reminder_error` stayed
  `null` across all rows — no failures.
- Test bookings deleted after verification.

## Status: feature complete

Appointment reminders (backlog #1) are live in production:
- 24h + 1h emails, Spanish by default (`EMAIL_LOCALE` pin, all guest emails)
- Scheduled via Supabase `pg_cron` + `pg_net` (primary), GitHub Actions
  `reminders-cron.yml` kept as a manual-only fallback
- Failure visibility surfaced on the panel calendar
- All decisions, deviations, and the cron-reliability finding/fix are
  recorded above for future reference.
