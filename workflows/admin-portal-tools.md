# Workflow: Admin Portal Tools

The internal-only tools in stanize/kaminolabs-kalendar-admin, used by KaminoLabs staff (not clinics) to support customers and manage the platform. Note: this workflow's code lives in a separate repo from this file — kept here per Arun's preference to have all workflow state centralized under this repo's /workflows/.

## Step: customer-overview
Status: done
Criteria:
- /admin/customers exists and lists clinic businesses

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

## Step: subscriptions-lookup-tool
Status: not_started
Criteria:
- Admin tool for support staff to look up a business's live Stripe subscription state and take action (e.g. cancel a stray/duplicate subscription) — see subscription-billing.md's feature-gating step, which this supports
- Not yet built; no /admin/subscriptions route or equivalent exists today

## Step: appointment-generator-dev-tool
Status: done
Criteria:
- /admin/appointment-gen exists, marked dev-only in the sidebar

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
