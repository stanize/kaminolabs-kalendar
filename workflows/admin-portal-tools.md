# Workflow: Admin Portal Tools

The internal-only tools in stanize/kaminolabs-kalendar-admin, used by KaminoLabs staff (not clinics) to support customers and manage the platform. Note: this workflow's code lives in a separate repo from this file — kept here per Arun's preference to have all workflow state centralized under this repo's /workflows/.

## Step: customer-overview
Status: done
Criteria:
- /admin/customers exists and lists clinic businesses

## Step: customer-dashboard
Status: not_started
Criteria:
- DESIGN SETTLED (2026-09-26, Arun) — a full support/ops dashboard,
  extending `customer-overview` above (same `/admin/customers` list/detail
  in the admin repo, add columns/fields and one new sub-page rather than a
  separate top-level page) so Arun can support clinics and spot at-risk or
  inactive accounts without asking them. SUPERSEDES the smaller
  `customer-usage-stats` step this replaces (last-login + appointment-count
  only) — that scope is now fully subsumed here, nothing from it is lost.
- **Row granularity: one row per business/clinic**, not per login. Team
  members aren't separate Better Auth accounts today (just data rows on
  `kalendar_team_members`), so "the account" for this purpose is the
  business's `owner_id` → `"user"` row.

### 1. Clinic overview
- Name, type, plan (`plan_type`: solo/multi), subscription status
  (mirrors Stripe's own status string 1:1 on `kalendar_businesses.
  subscription_status` — trialing/active/past_due/canceled/etc., already
  tracked), trial end date (from Stripe, same source `getSubscriptionDetail`
  in `lib/billing/stripe-data.ts` already reads for the clinic's own
  `/panel/settings` page — reuse that function, don't re-derive), owner's
  contact email, `created_at`.

### 2. Appointments count
- Three separate numbers, all scoped to `business_id`, no single collapsed
  total: **live** (upcoming, `status in ('pending_confirmation',
  'confirmed')` and `starts_at` in the future), **past confirmed**
  (`status = 'completed'`, or `starts_at` in the past with `status =
  'confirmed'` if the clinic never explicitly marked it — check which
  read this codebase's own `lib/booking/client-status.ts`/calendar-
  management-past.md conventions already use for "past confirmed" so this
  matches the clinic-facing panel's own definition exactly rather than
  inventing a second one), **past cancelled** (`status = 'cancelled'`).

### 3. Booking slug — admin-editable, with a real delink/relink lifecycle
- DECISION (2026-09-26, Arun): changing a slug requires the admin to also
  enter a short note (why) — becomes support-ticket history, costs
  nothing to add. On save, the clinic's `contact_email` gets an automatic
  notification email (new template needed in `lib/email.ts`, plain
  "your booking page address changed to X" copy, Spanish, matching this
  file's existing guest/owner email conventions).
- DECISION (2026-09-26, Arun) — **the old slug must NOT be deleted or
  silently freed** when changed/removed from a clinic. A slug has its own
  lifecycle, independent of which business currently holds it:
  1. **Delink**: business loses the slug (its booking page is no longer
     reachable at that address), but the slug string itself stays
     reserved — nobody else can claim it, it isn't recycled automatically.
  2. **Relink or delete**: from that reserved state, an admin either links
     the slug to another business (possibly a different one than
     originally), or explicitly deletes the reservation to truly free the
     string for reuse.
- This needs a real (small) schema change — today `slug` lives directly on
  `kalendar_businesses` as a `unique not null` column, which can't express
  "exists but unlinked." Proposed shape (finalize exact column/constraint
  details at build time):
  ```sql
  create table kalendar_slug_registry (
    slug        text primary key,
    business_id uuid references kalendar_businesses(id) on delete set null, -- null = delinked, held in reserve
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
  );
  ```
  `kalendar_businesses.slug` becomes **nullable** (null = "no active slug
  right now"); `slug_status`/`slug_flag_reason`/`slug_reviewed_at`/
  `slug_reviewed_by` (the existing moderation columns) likely move onto
  the registry row too, since moderation is really a property of the slug
  string's current claim, not the business — confirm this migration shape
  carefully at build time since `slug` is read pervasively across the
  codebase (public routing, `getPublicBookingData`, onboarding, the
  existing `/admin/slugs` review queue) — this is real, non-trivial
  surface area to update consistently, flagged explicitly as the biggest
  single piece of build risk in this whole dashboard design.

### 4. Additional signals (Arun agreed, beyond the original 3-item ask)
- **Slug moderation status** (`pending_review`/`rejected`/`active`, per
  #3's registry) — surfaces "this clinic's booking page isn't even live"
  at a glance.
- **Onboarding completion** (`onboarding_completed_at` null vs set) —
  flags a clinic that signed up but never finished Negocio/Servicios/
  Equipo/Disponibilidad setup.
- **Is-demo flag** (`is_demo`) — excludes/flags presales demo accounts so
  they don't get confused with real paying customers in this dashboard.
- **WhatsApp enabled** (`kalendar_whatsapp_config.enabled`) — adoption
  signal for the newer channel.
- **Open support tickets count** (`kalendar_support_tickets`, already
  exists) — so an open ticket is visible right on the clinic's row, no
  cross-referencing a separate screen.

### 5. Activity tracking (Arun's follow-up ask — multiple signals, not just login)
- DECISION (2026-09-26, Arun + Claude, agreed): a single login is a weak
  proxy for real usage — a clinic that logs in but never touches a
  booking is a materially different problem than one that's fully dark.
  Track (and surface separately, not collapsed into one flag) THREE
  distinct signals:
  1. **Last login** — `max(session."createdAt")` for the business's
     `owner_id`, already fully derivable today, zero new tracking.
  2. **Last appointment manually created** — needs a NEW column,
     `booking_channel` on `kalendar_bookings`
     (`'public_web' | 'whatsapp' | 'panel_manual'`), set once at insert
     time in each of the three existing creation paths (`submitBookingImpl`
     in `lib/actions/booking.ts` for both web and WhatsApp — the WhatsApp
     path is already distinguishable there via context, confirm exact
     signal at build time — and `createBookingAsOwner` in
     `lib/actions/booking-owner.ts` for the manual path). Today there is
     NO way to distinguish "clinic manually created this via the panel"
     from "a guest booked it themselves" — both produce a `patient_id`-null
     row with a name/email/phone — this column closes that gap. Then
     `last_manual_booking_at` = `max(created_at) where booking_channel =
     'panel_manual'`.
  3. **Last appointment status updated** — needs a NEW column,
     `status_updated_at timestamptz`, touched ONLY by the explicit
     clinic actions that change a booking's `status` (confirm, cancel,
     mark completed/no-show — via `booking-owner.ts`'s existing status-
     changing actions), deliberately NOT the generic `updated_at` (which
     also changes on unrelated edits like notes or payment marking) — so
     this is a clean "are they actually managing appointments" signal,
     not a noisy one.
  - Both new columns are additive (`schema_subset_NNN.sql`, standalone,
    non-destructive per this file's usual migration convention — check
    `ls supabase/` for the next number at build time) plus folded into
    `schema_001.sql`.
  - Arun flagged wanting to extend this signal set further later (more
    activity types beyond these three) — this design intentionally keeps
    each signal as its own column/query rather than a single computed
    "active/inactive" boolean, specifically so more signals can be added
    later without restructuring what's already there.
- These three signals surface on the main `/admin/customers` list (so
  Arun can eyeball inactivity across all clinics at a glance) as well as
  each clinic's own detail view.

### Cross-repo notes
- This reads from the MAIN app's database (`session`, `kalendar_bookings`,
  `kalendar_businesses`, `kalendar_whatsapp_config`,
  `kalendar_support_tickets`, the new `kalendar_slug_registry`) but the
  page lives in the ADMIN repo — confirm at build time how the admin repo
  already connects to the main app's Supabase project (it must already do
  this for `customer-overview` to work at all) and reuse that exact
  connection, not a new one.
- NOT VERIFIED AGAINST ACTUAL ADMIN-REPO CODE — same caveat as
  `manual-role-grant-tool` below: `kaminolabs-kalendar-admin` wasn't
  cloned for this design pass. Sanity-check `/admin/customers`'s actual
  current columns/query, and `/admin/slugs`'s actual current
  implementation (since #3 above restructures the data it reads), before
  building, rather than assuming either slots in cleanly.

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
