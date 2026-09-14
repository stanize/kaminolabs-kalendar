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
- OUT OF SCOPE for this step, noted as adjacent findings from the same
  review so a future pass doesn't assume they're covered here: an owner-
  facing "something failed" surface for clinics themselves (review section
  5's "blind spot," distinct from Arun/platform-level monitoring — that's
  product UX work, not observability infra), a documented/tested Supabase
  PITR backup story (review section 4, a separate go-live gap not part of
  the "next 3"), and a support/incident contact path for "the booking page
  is down" urgency (review section 5, also not part of the "next 3"). Flag
  these to Arun as candidates for their own workflow entries if/when he
  wants them tracked — not creating steps for them here since they weren't
  part of what he asked to be turned into workflows this pass.

## Notes / Deviations
- This gap, like legal-compliance.md's privacy/ToS gap, was surfaced by an
  independent MVP-readiness review rather than emerging from normal build
  work — treat as a genuinely fresh finding.
- docs/reviews/2026-09-14-review.md itself is the source of truth for the
  full context/reasoning behind this file; this workflow entry summarizes
  the actionable parts relevant to implementation, not a full restatement.
