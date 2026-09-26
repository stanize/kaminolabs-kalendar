# Workflow: Admin Portal Tools

The internal-only tools in stanize/kaminolabs-kalendar-admin, used by KaminoLabs staff (not clinics) to support customers and manage the platform. Note: this workflow's code lives in a separate repo from this file — kept here per Arun's preference to have all workflow state centralized under this repo's /workflows/.

## Step: customer-overview
Status: done
Criteria:
- /admin/customers exists and lists clinic businesses

## Step: customer-usage-stats
Status: not_started
Criteria:
- DESIGN SETTLED (2026-09-26, Arun) — a support/ops dashboard extension to
  `customer-overview` above (same `/admin/customers` list/detail, add
  columns/fields rather than a new page), showing per-clinic usage signals
  so Arun can spot inactive or struggling accounts without asking them.
- **Row granularity: one row per business/clinic**, not per login. Team
  members aren't separate Better Auth accounts today (just data rows on
  `kalendar_team_members`), so "the account" for this purpose is the
  business's `owner_id` → `"user"` row.
- **Last login**: `max(session."createdAt")` for that `owner_id`, joined
  from the main app's own `session` table (`supabase/schema_better_auth_001.sql`)
  — a session row's creation IS a login, no new tracking needed, this
  data already exists today.
- **Last logout: explicitly NOT built.** Better Auth has no logout-event
  concept — signing out just deletes the session row, there's nothing to
  read `max()` of. DECISION (2026-09-26, Arun, agreed): don't build an
  explicit sign-out event log for this. A recent last-login already tells
  Arun the account is active; logout timestamps add real build cost
  (instrumenting all three auth forms' sign-out paths, redirects, and
  session-expiry) for a less actionable signal. Revisit only if a real
  support need for it comes up later.
- **Appointment count**: a plain `count(*)` of `kalendar_bookings` for that
  `business_id` — all-time total, no status filter, no breakdown/chart per
  Arun's "number only" framing. (Open question for the build session: does
  "number only" mean literally just a single lifetime total, or would a
  simple all-time-vs-this-month pair still count as "a number, not a
  chart"? Default to the single lifetime total unless Arun says otherwise
  when this is actually built.)
- **Cross-repo data**: this reads from the MAIN app's database
  (`session`, `kalendar_bookings`, `kalendar_businesses`) but the page
  lives in the ADMIN repo — confirm at build time how the admin repo
  already connects to the main app's Supabase project (it must already do
  this for `customer-overview` to work at all) and reuse that exact
  connection, not a new one.
- NOT VERIFIED AGAINST ACTUAL ADMIN-REPO CODE — same caveat as
  `manual-role-grant-tool` below: `kaminolabs-kalendar-admin` wasn't
  cloned for this design pass. Sanity-check `/admin/customers`'s actual
  current columns/query before building, rather than assuming this slots
  in cleanly.

## Step: slug-reviews
Status: done
Criteria:
- /admin/slugs exists — moderation queue for flagged (non-clean) booking-page slugs

## Step: orphaned-bookings
Status: done
Criteria:
- /admin/orphaned-bookings exists

## Step: admin-users
Status: done
Criteria:
- /admin/users exists — manages the admin allowlist

## Step: manual-role-grant-tool
Status: not_started
Criteria:
- DEPENDENCY of clinic-onboarding.md's no-self-service-dual-role-accounts
  step — that step removes the self-service "add the other role too?"
  confirm gates and replaces them with "contact support." This step is
  the other half: what Arun actually does once that ticket arrives. Without
  this, "contact support" is a promise with no way to fulfil it.
- NOT VERIFIED AGAINST ACTUAL ADMIN-REPO CODE (flagging explicitly, unlike
  this file's other done steps): stanize/kaminolabs-kalendar-admin wasn't
  cloned for this design pass — no PAT was provided for it this session.
  What follows is a reasonable design given the schema and the pattern of
  the other done admin tools in this file, not a verified read of the
  admin repo's actual current structure. Worth a quick sanity check
  against the real admin codebase before building, same as any other step.
- Data model (verified against THIS repo's schema_001.sql, which the
  admin app reads/writes against): user_roles is a simple composite-key
  table (user_id, role) with role constrained to 'clinic' | 'patient' —
  granting a second role is just inserting one row. No new schema needed.
- NOTE: schema_001.sql's own comment on user_roles is now stale — it
  currently says a user who enters via both paths over time "accumulates
  both roles... never in conflict," describing the OLD self-service
  design this step's sibling is removing. Worth updating that comment
  when the code change actually lands (in this repo, not the admin one),
  so it doesn't mislead whoever reads the schema next.
- Minimum viable version: on the existing /admin/customers page (or
  wherever an admin already looks up a specific user/business), a way to
  look up a user by email and see their current role(s), plus a button to
  add the missing one. Given the low expected volume (a manual, human-
  approved exception per Arun's own framing in the decision this
  supports), this doesn't need to be more sophisticated than that for v1
  — no bulk actions, no self-service anything, just a lookup + one button
  for Arun's own use.
- Should log SOMETHING (even just a console.error-style audit line, per
  this app's existing lightweight logging pattern elsewhere) noting which
  admin granted which role to which user and when — not for compliance
  reasons at this scale, just so a "wait, why does this account have both
  roles" question is answerable later without having to remember.
- Out of scope for this step: revoking a role (removing dual-role access
  once granted) — not asked for, and the decision this supports is about
  preventing accidental self-service ADDITION, not about an offboarding
  flow. Revisit only if a real need for revocation comes up.

## Step: subscriptions-lookup-tool
Status: not_started
Criteria:
- Admin tool for support staff to look up a business's live Stripe subscription state and take action (e.g. cancel a stray/duplicate subscription) — see subscription-billing.md's feature-gating step, which this supports
- Not yet built; no /admin/subscriptions route or equivalent exists today

## Step: appointment-generator-dev-tool
Status: done
Criteria:
- /admin/appointment-gen exists, marked dev-only in the sidebar
- UPDATED (2026-09-19, main repo): the main repo's booking-abuse-protection
  step (public-booking.md) added a per-IP-per-day rate limit to
  submitBooking, which app/api/internal/appointment-gen/route.ts (this
  tool's backend, main repo) calls directly to create each test booking —
  bulk-generating appointments would have started failing after 5-10 calls
  from the same IP. Fixed on the main repo's side, nothing to change
  here: the route now calls a separate submitBookingInternal export
  (skips the rate limit entirely, never importable from a client
  component so it's not reachable from a browser) instead of the public
  submitBooking. Confirm this still generates appointments without
  hitting an error once main's fix is deployed.

## Step: date-cycler-dev-tool
Status: done
Criteria:
- /admin/date-cycler exists, marked dev-only in the sidebar

## Step: schema-reset-tool
Status: in_progress
Criteria:
- /admin/schema-reset exists, marked dev-only in the sidebar
- Readiness check (main app API reachability) shown before allowing a reset, with a manual Recheck button
- Type-to-confirm phrase required before the reset button is enabled
- Reset re-runs schema_better_auth_001.sql then schema_001.sql from the main app's current deployment, dropping and recreating every kalendar_* table plus user_roles
- On success, shows live post-reset row counts per table (SchemaResetPanel's counts state / TableCount[] result)
- BUG (mobile): the post-reset results table (<table> in SchemaResetPanel) has no overflow-x-auto wrapper or other mobile-responsive handling. On a narrow mobile viewport the table clips/squeezes, making the row counts effectively unreadable/invisible — reported directly by Arun testing on mobile Safari, screenshot shows the "Reset database schema" confirmation copy but the counts table below it is not usable at that width.

## Step: incremental-schema-reset-modes
Status: not_started
Criteria:
- Schema files move from a single always-destructive schema_001.sql to a numbered series (schema_001.sql, schema_002.sql, etc.)
- Once a schema file is "frozen" (its tables considered stable/permanent), no further destructive changes are made to it — new columns needed on its tables are added via non-destructive ALTER TABLE ... ADD COLUMN IF NOT EXISTS statements in the next file, never by editing the frozen file's DROP/CREATE block
- Each new schema file's destructive drop/create block stays scoped strictly to its own new tables — re-running it never touches a prior frozen file's tables or data
- Schema-reset tool gains two modes: Full reset (runs every schema file in order, schema_001.sql through latest — today's existing behavior) and Reset latest only (runs only the newest unfrozen schema file, leaving all prior frozen files' tables/data untouched — used during active iteration so test data in frozen tables like businesses/clients survives repeated resets while only the newest tables get wiped/rebuilt)
- OPEN QUESTION (needs a design call before building): how the tool determines which schema file is "latest/unfrozen" — a naming convention (always run the highest-numbered schema_NNN.sql) vs. an explicit marker (e.g. a comment header in the file, or a config value) it reads. Not decided yet.
- Depends on: schema_001.sql actually being frozen, and schema_002.sql existing — not buildable until both are true

## Step: incident-contact-path
Status: not_started
Criteria:
- SURFACED (2026-09-14, docs/reviews/2026-09-14-review.md, section 5
  "Blind spots not currently tracked" — not one of the ranked "next 3,"
  but explicitly named). Direct quote: "the support ticket form exists
  for Arun to see tickets, but there's nothing for 'the booking page is
  down' urgency."
- The gap is specifically about URGENCY mismatch, not absence of a support
  channel — lib/actions/support.ts's submitSupportTicket already exists
  and works fine for normal issues. Two things make it the wrong tool for
  a genuine outage:
  - It requires an authenticated session (submitSupportTicket returns
    early if no session) — if the outage is bad enough that a clinic
    owner can't log in either, they have no path to reach Arun through
    the product at all.
  - Even when login works, a ticket sitting in a queue Arun checks
    periodically is the wrong response time for "my booking page is down
    right now and a patient is standing in front of me."
- Candidate approaches, not decided — needs a call with Arun before
  building, this is a starting menu not a spec:
  - A status page (even a trivial static one) with a direct emergency
    contact (email/WhatsApp/phone) that doesn't require being logged in
    — lowest build cost, matches how most small SaaS tools handle this.
  - A dedicated "urgent" flag on the existing support ticket that (when
    set) triggers something faster than the normal queue — e.g. an SMS/
    push to Arun — but doesn't solve the "can't log in" case above on its
    own.
  - Both together: logged-out emergency contact for total outages, urgent
    flag on the existing ticket form for degraded-but-reachable cases.
- Realistic for a single-founder operation (Arun, not a support team) —
  don't over-scope this into a full incident-management process; the
  actual need per the review is "a real human can be reached fast when
  something's badly broken," not a formal SLA/status-page product.

## Notes / Deviations
- All admin portal pages are worth spot-checking for the same mobile-table pattern as schema-reset-tool, since this may not be an isolated instance (e.g. customer-overview and orphaned-bookings likely also render tabular data) — flagging for a future pass rather than assuming it's fixed by fixing schema-reset alone.
