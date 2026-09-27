# Workflow: Error Monitoring / Observability

Real-time visibility into failures across the app — Stripe webhooks, reminder sends, the bono trigger, general client-side errors. No workflow previously tracked this; surfaced by docs/reviews/2026-09-14-review.md ("Recommended next 3" #3) as a go-live gap, not a previously-scoped-then-missed item.

## Step: baseline-client-error-logging
Status: done
Criteria:
- Already built, predates this workflow file — documenting the existing baseline here so the sentry-integration step below has something concrete to describe as "the upgrade from."
- IMPLEMENTATION: reportClientError() (lib/report-client-error.ts) is a fire-and-forget POST to /api/log-client-error (app/api/log-client-error/route.ts), which forwards into Vercel's runtime logs via console.error — queryable the same way server-side errors already are, but NOT persisted anywhere beyond Vercel's own log retention, no alerting, no dashboard, no rate limiting beyond what's built in.
- Deliberately minimal and explicitly built as a stopgap — its own code comments already flag Sentry as "the eventual upgrade path once there's real traffic/paying clinics to justify it." Per the 2026-09-14 review, that condition is now being met.
- Not automatic/global — only call sites that explicitly call reportClientError() land here. Coverage today is incremental/partial, added as specific failures mattered (e.g. the patient-registration 400 that motivated building this at all), not a blanket catch-all for every client-side error.

## Step: sentry-integration
Status: not_started
Criteria:
- SURFACED (2026-09-14, docs/reviews/2026-09-14-review.md — "Recommended
  next 3" #3): wire up Sentry (or, as a lower-effort interim step, a
  scheduled digest of the existing log-client-error console logs) before
  the first real clinic goes live, not after. Rationale from the review:
  right now a silent failure (a reminder that doesn't send, a webhook that
  doesn't process) is only visible if someone happens to go looking in
  Vercel logs — there's no push notification of any kind today.
- Two real options, not necessarily exclusive — confirm with Arun which to
  start with:
  - Full Sentry integration: client + server error capture, replacing/
    supplementing baseline-client-error-logging's console.error forwarding
    with a proper dashboard, alerting, and issue grouping. More setup, more
    capability (stack traces with source maps, release tracking, etc).
  - Interim/cheaper: a scheduled digest (e.g. a daily cron hitting Vercel's
    log API, or even just a manual daily glance) that surfaces anything
    logged via the [client-error] tag plus server-side errors — lower
    build cost, no new third-party dependency, but no real-time alerting
    and someone has to actually read the digest.
- SPECIFIC FAILURE POINTS the review calls out as currently invisible if
  they fail silently (these are the concrete cases this step needs to
  actually cover, not just "errors in general"):
  - Stripe webhook processing failures (app/api/webhooks/stripe/route.ts,
    kalendar_stripe_webhook_events) — a payment-side failure here has
    direct revenue consequences and currently has no owner-facing or
    Arun-facing surface if it silently fails.
  - Reminder send failures (app/api/cron/send-reminders/route.ts,
    lib/email.ts) — appointment-reminders.md already tracks a booking-
    level UI marker for reminder failures visible to the clinic, but
    that's a different thing from Arun/the platform knowing a failure
    happened at all, systemically, without a clinic having to notice and
    report it first.
  - bono trigger failures (sync_bono_session_usage) — a failure here would
    silently corrupt session counts; per bonos.md this is now the sole
    source of truth for that bookkeeping, so a silent failure here is
    higher-stakes than it would have been under the old split-write design.
- RE-FLAGGED (2026-09-27, docs/reviews/2026-09-27-review.md): zero change
  since 2026-09-14 — no `sentry` package anywhere in `package.json`, still
  only the pre-existing `console.error` forwarding. Review's "recommended
  next 3" #3: ship the cheap interim option first, not necessarily full
  Sentry — three separate silent-fail-by-design systems (WhatsApp sends,
  the bono trigger, rate-limiting) are now live with nothing reading
  their logs systematically, so "someone happens to check Vercel logs"
  is no longer a reasonable safety net.
- SUPERSEDED (2026-09-27): the "scheduled digest" bullet under "two real
  options" above is no longer the plan — see `structured-event-log`
  below, which replaces it with a proper log table + admin dashboard
  instead (the digest's premise, reading Vercel's log API from a cron,
  turned out not to be viable on the Hobby plan anyway). Full Sentry
  integration is still on the table as a separate, later, not-mutually-
  exclusive upgrade — this note doesn't close that option, just the
  digest one.
- NOW TRACKED SEPARATELY (2026-09-14, follow-up to Arun's request to turn
  the review's remaining findings into workflows too): the owner-facing
  failure surface and the backup/PITR story below are now their own steps
  in this file rather than out-of-scope notes. The incident-contact-path
  gap (review section 5's "the booking page is down" urgency) is tracked
  in admin-portal-tools.md instead, since it's a support/ops-tooling
  concern rather than an observability one — see that file's
  incident-contact-path step.

## Step: structured-event-log
Status: not_started
Criteria:
- DESIGN SETTLED (2026-09-27, discussion with Arun following the
  2026-09-27 review's "recommended next 3" #3). Supersedes the
  "scheduled digest" half of sentry-integration's two options above —
  investigation found no Vercel log-drain/export mechanism wired up
  anywhere in the repo, and Vercel's log query/retention API is normally
  a paid-plan feature (this project is on Hobby), so "a cron job reads
  Vercel's logs" was never actually viable as described. This step is
  the real interim mechanism instead: not a digest, a **queryable,
  filterable, bulk-manageable log table with its own admin dashboard**.
  Full Sentry remains a separate, later, not-mutually-exclusive option
  if/when real traffic justifies it — this step doesn't block that.
- SCOPE, PER ARUN: "everywhere an error is published" — every existing
  bracketed-tag `console.error`/`console.log` call site in the codebase
  gets wired into this, not just the three tags the review named
  ([client-error], [whatsapp], [rate-limit]). Confirmed call sites to
  retrofit (found via full-codebase grep, 2026-09-27): [client-error]
  (app/api/log-client-error/route.ts), [whatsapp] (app/api/whatsapp/
  webhook/route.ts, lib/actions/booking-owner.ts), [rate-limit]
  (lib/rate-limit.ts), [stripe-webhook] (app/api/webhooks/stripe/
  route.ts), [reminders] (app/api/cron/send-reminders/route.ts),
  [stripe-reconcile] (app/api/cron/stripe-reconcile/route.ts),
  [pricing-phase-notify] (app/api/cron/pricing-phase-notify/route.ts),
  [email] (lib/email.ts), [auth-pool] (lib/auth.ts), [provisionPatient]
  (lib/actions/patient.ts), plus the non-fatal failure logs in
  lib/actions/booking.ts/booking-owner.ts ([submitBookingImpl],
  [updateBookingResult], [createBookingAsOwner]) and
  lib/actions/billing.ts ([createSubscriptionIntent]). Existing
  console.error/console.log calls stay in place (Vercel logs remain the
  raw backstop) — this ADDS a DB write alongside each one, via one
  shared helper, not a rewrite of the failure-handling logic itself.
- ALSO A GENERAL DEBUG LOG, PER ARUN: not error-only — severity spans
  `debug`/`info`/`warning`/`error`/`critical`. The intent is Arun can
  drop a temporary `logEvent('some-tag', 'debug', message, context)`
  call anywhere in the code while troubleshooting something live, deploy,
  watch it show up in the dashboard, then remove it — a serverless-
  friendly alternative to digging through Vercel's log viewer. This
  shapes the schema and the dashboard equally: needs to stay fast/usable
  even when someone is temporarily logging at high volume for a debug
  session, hence the bulk-delete requirement below.
- SCHEMA (new table, `kalendar_error_log`, folded into schema_001.sql +
  a new schema_subset_0NN.sql per the migration convention — Arun runs
  it, this session only creates the file):
  - `id` uuid pk
  - `source` text — `'server'` | `'client'`
  - `tag` text — matches the existing bracketed tags above (e.g.
    `'whatsapp'`, `'stripe-webhook'`), lets a debug session invent its
    own ad-hoc tag too
  - `severity` text — `'debug'` | `'info'` | `'warning'` | `'error'` |
    `'critical'`
  - `message` text
  - `stack` text, nullable — populated for client JS errors, rarely for
    server-side logs
  - `business_id` uuid, nullable, FK → `kalendar_businesses` — the key
    filter for "show me every error for this clinic"; nullable since
    not every log has a resolvable business (e.g. auth-pool errors)
  - `context` jsonb — catch-all for anything specific to that call site
    (booking id, IP, Stripe event id, etc.) rather than a new column per
    log type
  - `environment` text — from `VERCEL_ENV` (`production`/`preview`/
    `development`), so local/preview noise doesn't pollute production
    filtering
  - `request_url` text, nullable
  - `resolved` boolean, default false — dashboard can mark rows as seen
  - `created_at` timestamptz, default now()
  - Indexes on `business_id`, `tag`, `severity`, `created_at`, `resolved`
    — the actual filter fields the dashboard needs.
- WRITE-SIDE MECHANISM (main repo, `stanize/kaminolabs-kalendar`): one
  shared `logEvent(tag, severity, message, context?)` helper (new file,
  e.g. `lib/server-error-log.ts`) — does the existing `console.error`
  AND inserts a row. Swapped in at every call site listed above.
  `reportClientError()`/`app/api/log-client-error/route.ts` gets the
  same treatment on the client-error path, writing to the same table
  instead of (well, in addition to) only forwarding to `console.error`.
- RATE LIMIT ON THE CLIENT-ERROR ROUTE (Arun agreed, 2026-09-27):
  `/api/log-client-error` is unauthenticated (has to be — it fires from
  any visitor's browser, including anonymous guests on the public
  booking page). Once it writes into a permanent table that's the
  literal data source for a dashboard meant to surface real signal, an
  unrate-limited flood (scripted, no auth/CSRF needed) becomes a
  signal-to-noise attack on the tool itself, not just log spam — same
  abuse shape `docs/security/vulnerabilities.md`'s V-002 already flags
  for `submitBooking`. Fix: reuse the already-live
  `kalendar_rate_limit_hits`/`increment_rate_limit_hit` mechanism
  (confirmed live 2026-09-27), generous per-IP daily cap (e.g. 30–50/day
  — a real browser session hitting a real bug won't come close; a
  flooding script gets cut off fast), fails open like the existing
  limiter (an infra hiccup means uncapped that day, never "logging
  breaks").
- READ-SIDE / DASHBOARD (admin repo, `stanize/kaminolabs-kalendar-admin`,
  attached this session): a new page reading `kalendar_error_log`
  directly (service-role, same access pattern as the rest of the admin
  portal). Requirements, per Arun:
  - Filters: at minimum tag, severity, business, environment, resolved,
    date range, plus free-text search on message.
  - Bulk delete: filter-driven, not just per-row checkboxes — "delete
    everything matching the current filter" in one action, since ad-hoc
    debug-session logging can generate many short-lived rows that need
    clearing in bulk, not one at a time. Pair this with a resolved-status
    bulk action too (mark all matching as resolved), since they're the
    same UI shape.
  - Exact page layout/route within the admin portal is an implementation
    detail to settle at build time against that repo's own conventions
    (read its CLAUDE.md first) — not designed further here.
- OUT OF SCOPE for this step (confirmed distinct from it): full Sentry
  integration (still a separate future option); owner-facing-failure-
  surface below (that's the CLINIC noticing a failure, this step is
  Arun/the platform noticing); the bono-trigger-failure logging gap
  specifically — per the codebase survey, `sync_bono_session_usage`
  fails DB-side (a Postgres trigger) and currently has NO app-code
  console.error call site to retrofit at all; wiring that in needs its
  own small design pass (likely a `RAISE`/exception-log write, or a
  Postgres-side call into this same table) rather than being assumed
  solved by this step's app-layer helper.

## Step: owner-facing-failure-surface
Status: not_started
Criteria:
- SURFACED (2026-09-14, docs/reviews/2026-09-14-review.md, section 5
  "Blind spots not currently tracked" — not one of the ranked "next 3,"
  but explicitly named and worth tracking on its own). Distinct from
  sentry-integration above: that step is about ARUN/the platform knowing
  a failure happened; this step is about the CLINIC OWNER knowing, without
  having to notice a symptom (a patient complaining, a booking that never
  showed up) and report it first.
- Review's own framing of the gap: "reminder failures have a UI marker
  now, but Stripe webhook failures, email-send failures on booking
  confirmation, and bono-trigger failures have no owner-facing surface."
  appointment-reminders.md's existing reminder-failure UI marker is the
  precedent/pattern to extend, not something to rebuild.
- Candidate failure points to surface, in rough priority order (highest
  business impact first — confirm with Arun before building, this is a
  starting list, not a locked scope):
  - Booking-confirmation email failing to send — the guest/patient may
    believe their booking didn't go through (or never gets their
    calendar invite/manage link) even though it's genuinely confirmed in
    the system. Arguably the highest-impact one, since it can cause a
    guest to double-book elsewhere or simply not show up unprepared.
  - Stripe webhook processing failures affecting the CLINIC's own
    subscription state (not booking payments — Kalendar's own SaaS
    billing) — e.g. a failed renewal the clinic doesn't find out about
    until their access is affected.
  - bono trigger failures — silent session-count corruption is exactly
    the failure mode session-deduction-on-payment's design was meant to
    eliminate; if the trigger itself fails, the clinic has no way to know
    their bono counts may now be wrong.
- Open design question, not resolved here: does this mean an in-app
  notification/banner (clinic logs into /panel and sees "we had trouble
  sending your last booking confirmation email"), an actual email to the
  clinic, or both? Depends on urgency per failure type — probably not a
  single uniform mechanism for all three failure points above. Needs a
  design pass before implementation, not just a build.

## Step: backup-data-safety-story
Status: not_started
Criteria:
- SURFACED (2026-09-14, docs/reviews/2026-09-14-review.md, section 4 —
  ranked gap #4, not one of the top-3 recommended, but explicitly called
  out as blocking a safe go-live). Direct quote from the review: "Supabase
  almost certainly has PITR available on the plan, but nothing in the repo
  confirms it's configured or tested for this project specifically."
- This is primarily a CONFIRMATION + DOCUMENTATION task, not necessarily a
  build task — the review's own wording suggests the capability likely
  already exists on Supabase's side, the gap is verifying it's actually
  turned on for kaminolabs-kalendar's specific project and writing that
  down somewhere durable (supabase/SETUP.md is the natural home, since
  that's already the file documenting this project's Supabase setup).
- Concretely needed: (1) confirm Point-In-Time-Recovery is enabled on the
  Supabase plan this project is actually running on, not just "available
  in general," (2) confirm/note the actual retention window, (3) actually
  TEST a restore at least once rather than assuming it works — the review
  specifically flags "configured or tested," not just configured, (4)
  write the above down in supabase/SETUP.md so it's not tribal knowledge.
- Out of scope for this step: broader disaster-recovery planning beyond
  the database itself (e.g. Vercel deployment rollback strategy) — not
  mentioned in the review, don't scope-creep into it here.

## Notes / Deviations
- This gap, like legal-compliance.md's privacy/ToS gap, was surfaced by an
  independent MVP-readiness review rather than emerging from normal build
  work — treat as a genuinely fresh finding.
- docs/reviews/2026-09-14-review.md itself is the source of truth for the
  full context/reasoning behind this file; this workflow entry summarizes
  the actionable parts relevant to implementation, not a full restatement.
