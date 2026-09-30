# Workflow: Admin Portal Tools

The internal-only tools in stanize/kaminolabs-kalendar-admin, used by KaminoLabs staff (not clinics) to support customers and manage the platform. Note: this workflow's code lives in a separate repo from this file — kept here per Arun's preference to have all workflow state centralized under this repo's /workflows/.

## Step: customer-overview
Status: done
Criteria:
- /admin/customers exists and lists clinic businesses

## Step: customer-dashboard
Status: in_progress
Criteria:
- CODE IMPLEMENTED 2026-09-28 (both repos, typechecked/linted/built clean),
  PENDING MANUAL TESTING — not yet verified working live, per this file's
  own "workflow-file status after coding" convention. Built:
  - Main repo: kalendar_slug_history table + slug_active/booking_channel/
    status_updated_at columns (schema_subset_019.sql, folded into
    schema_001.sql); isSlugAvailable()/resolvePublicSlugRouting() in
    lib/business/data.ts wired into onboarding, panel business settings,
    demo provisioning, and /bookings/[slug]'s three-way messaging;
    booking_channel set at all 3 booking-creation paths; status_updated_at
    set by cancelBookingAsOwner/confirmBookingAsOwner/updateBookingResult;
    new app/api/internal/notify-slug-change route + slugChangedOwnerHtml
    email template (INTERNAL_SLUG_NOTIFY_SECRET).
  - Admin repo: /admin/customers/business/[businessId] dashboard
    (lib/admin/customer-dashboard.ts + business-dashboard-panel.tsx),
    linked from the customers table's Business column — clinic overview,
    appointment counts, slug editor (change/relink/delete-forever/
    slug_active toggle), additional signals, activity tracking.
  - Both DEFERRED items (Stripe trial-end-date reuse, "past confirmed"
    count) are still not built — the dashboard shows explicit placeholders
    for them ("— (next cycle)") rather than a guessed definition.
  - NOT YET DONE: schema_subset_019.sql has NOT been run against the live
    DB — Arun runs schema_subset_*.sql files himself via the Supabase SQL
    editor per this file's migrations convention. The code above will
    error against the live DB (missing columns/table) until that runs.
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
- DEFERRED TO NEXT CYCLE (2026-09-28, Arun) — everything else in this step
  is settled and Arun is happy with the design as-is; these two remaining
  gaps (found by a subagent cross-check against real current code in both
  repos — everything else checked out, and the slug redesign in #3 has
  since been resolved) are explicitly put on hold, not resolved now, and
  will be designed at the start of the next build cycle for this step:
  1. **`getSubscriptionDetail` (`lib/billing/stripe-data.ts`) can't
     actually be "reused" by the admin repo as originally phrased** — the
     two repos are separate Next.js deployments with no cross-repo
     import path, and that function calls Stripe directly from the main
     app. Needs a decision: either the admin repo gets its own copy of
     the Stripe call (+ its own Stripe env vars), or the main app exposes
     an internal API route the admin repo calls (precedent already
     exists for this shape — `INTERNAL_SCHEMA_API_SECRET` /
     `app/api/internal/schema/route.ts`).
  2. **"Past confirmed" appointment status has no existing definition to
     mirror.** Section 2 below originally cited `lib/booking/
     client-status.ts` as the precedent to match — that file actually
     defines something unrelated (guest vs. returning CLIENT
     relationship, not booking status). There's no existing "past
     confirmed" query anywhere in the codebase today; this needs to be
     designed fresh at build time, not copied from a panel query that
     doesn't exist.

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
  silently freed** when changed/removed from a clinic — a slug string,
  once used, should never become quietly claimable by an unrelated future
  signup.
- REDESIGNED — SIMPLER APPROACH (2026-09-28, Arun, verified against real
  code before this revision — see "verified against code" note below):
  supersedes the `kalendar_slug_registry` shape above (nullable
  `businesses.slug`, moderation columns moved off the business row). That
  version was flagged as this dashboard's single biggest build risk —
  `slug` is read pervasively (public routing, `getPublicBookingData`,
  onboarding, `/admin/slugs`'s existing review queue), and making it
  nullable + relocating `slug_status`/`slug_flag_reason`/
  `slug_reviewed_at`/`slug_reviewed_by` would have meant rewriting
  `/admin/slugs.ts`'s three working functions
  (`listPendingSlugReviews`/`approveSlug`/`rejectSlug`), not just adding
  fields. Arun's simpler version needs none of that:
  - `kalendar_businesses.slug` stays **exactly as it is today** —
    `text not null unique`, same column, same lookup, same moderation
    columns untouched, `/admin/slugs.ts` untouched.
  - New table, purely additive, records what used to exist — naming TBD
    at build time (Arun said "used slugs," `kalendar_slug_history` is a
    reasonable working name):
    ```sql
    create table kalendar_slug_history (
      id          uuid primary key default gen_random_uuid(),
      slug        text not null, -- the retired string
      business_id uuid references kalendar_businesses(id) on delete set null, -- who it used to belong to
      note        text not null, -- admin's reason, required (see decision above)
      changed_by  uuid, -- admin user id who made the change
      created_at  timestamptz not null default now()
    );
    create unique index on kalendar_slug_history (slug) where business_id is not null; -- adjust at build time: only one "currently retired, not yet reclaimed" row per slug string makes sense; exact constraint shape TBD
    ```
  - **Slug creation/change** (both admin-side and clinic onboarding):
    check uniqueness against `kalendar_businesses.slug` **and**
    `kalendar_slug_history.slug` — a retired string can never be silently
    reclaimed by an unrelated new signup.
  - **On change**: write a row into `kalendar_slug_history` for the OLD
    slug (with the required note), then update
    `kalendar_businesses.slug` to the new value — same single-column
    update mechanism as today, unchanged.
  - **Public routing** (`/bookings/[slug]`): look up
    `kalendar_businesses.slug` first (normal case, unchanged). On a miss,
    check `kalendar_slug_history` — if found there, show a distinct "this
    link is no longer active" page instead of the generic not-found page
    (a visitor with an old bookmark/business-card link gets a clear
    explanation, not silence).
  - **Relink** (give a retired string back to a business, same one or a
    different one): admin sets that business's `slug` to the retired
    string directly (after the uniqueness check above confirms it's still
    only in history), then the matching `kalendar_slug_history` row is
    deleted/archived so it stops reading as "retired" once it's active
    again.
  - **Delete-forever** (truly free a retired string for reuse by anyone):
    just delete its `kalendar_slug_history` row.
  - OPEN QUESTION EXPLICITLY RESOLVED, NOT DEFERRED: does "delink" ever
    need to leave a business with NO active slug (public page fully
    unreachable, no replacement assigned)? Arun: no — `slug` stays
    `not null`, a business always has exactly one active slug. What
    prompted the original nullable-slug idea (suspending a non-paying
    clinic's public page) is handled by a SEPARATE mechanism instead —
    see the new `slug_active` flag in "additional signals" below.
- VERIFIED AGAINST CODE (2026-09-28, subagent cross-check before this
  revision): confirmed `kalendar_businesses.slug` is `text not null
  unique` today (schema_001.sql), confirmed `/admin/slugs.ts`'s
  `listPendingSlugReviews`/`approveSlug`/`rejectSlug` currently read/write
  `slug_status`/`slug_flag_reason`/`slug_reviewed_at`/`slug_reviewed_by`
  directly on `kalendar_businesses` with real working logic — this
  redesign leaves all of that alone, which is the whole point of the
  simplification.

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
- **`slug_active` flag** (2026-09-28, Arun, new — resolves the
  "delink with no replacement" question from #3 above): new
  `kalendar_businesses.slug_active boolean not null default true`.
  Deliberately SLUG-SCOPED, not a general business `active`/`disabled`
  flag — Arun's planned graduated non-payment enforcement is multi-tier
  (a grace period where the panel stays reachable even after a
  subscription lapses, THEN the public booking page goes down after
  ~1-2 months, THEN, later, the panel itself locks after ~3-6 months) —
  this flag is specifically the middle tier. The eventual panel-lockout
  tier needs its own separate mechanism, not this column, so it's never
  overloaded to mean two different things.
  - When `false`: the public booking page shows "este negocio no está
    disponible temporalmente" (clinic booking page temporarily down) —
    DELIBERATELY DIFFERENT COPY from the retired-slug page in #3 (Arun:
    a "link no longer exists" message on a link that might come back is
    actively misleading — a visitor who sees "doesn't exist" won't try
    that link again later, even once the clinic's subscription is
    current and the page is back). The slug itself, and the business's
    claim on it, are completely unaffected — this only gates whether the
    public page renders, same slug throughout.
  - THIS PASS: manual admin toggle only, surfaced as a column/action on
    the dashboard row. Arun explicitly wants this wired to automatic
    subscription-status-based enforcement LATER, once the graduated
    non-payment ladder above is actually designed/built — not assumed or
    half-wired in this pass.

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
     time in each of the three existing creation paths (`submitBooking`/
     `submitBookingInternal` in `lib/actions/booking.ts:706,721` — NAME
     CORRECTED 2026-09-28, was previously misnamed `submitBookingImpl` in
     this doc — for both web and WhatsApp — the WhatsApp path is already
     distinguishable there via context, confirm exact signal at build
     time — and `createBookingAsOwner` in `lib/actions/
     booking-owner.ts:649` for the manual path). Today there is NO way to
     distinguish "clinic manually created this via the panel" from "a
     guest booked it themselves" — both produce a `patient_id`-null row
     with a name/email/phone — this column closes that gap. Then
     `last_manual_booking_at` = `max(created_at) where booking_channel =
     'panel_manual'`.
  3. **Last appointment status updated** — needs a NEW column,
     `status_updated_at timestamptz`, touched ONLY by the explicit
     clinic actions that change a booking's `status` — CONFIRMED 2026-09-28
     the specific functions are `cancelBookingAsOwner` (booking-owner.ts:48),
     `confirmBookingAsOwner` (booking-owner.ts:162), and
     `updateBookingResult` (booking-owner.ts:320, sets completed/no_show/
     cancelled) — deliberately NOT the generic `updated_at` (which also
     changes on unrelated edits like notes or payment marking) — so this
     is a clean "are they actually managing appointments" signal, not a
     noisy one.
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

## Step: testing-tracker
Status: in_progress
Criteria:
- CODE IMPLEMENTED 2026-09-30 (admin repo, typechecked/linted/built clean),
  PENDING MANUAL TESTING — not yet verified working live. Built: schema
  (schema_subset_020.sql, folded into schema_001.sql) for
  kalendar_test_cases / kalendar_testing_projects /
  kalendar_testing_project_cases; admin repo's `lib/admin/testing.ts` (CRUD
  + bulk import + project-creation-with-priority-filter + checklist status
  updates); new sidebar "Testing" section with Test cases
  (`/admin/testing/cases`) and Testing projects (`/admin/testing/projects`
  + `/admin/testing/projects/[projectId]`'s checklist) pages. NOT YET
  RUN against the live DB — same as this file's other schema_subset_*.sql
  entries, Arun runs these himself via the Supabase SQL editor.
- EXTENDED (2026-09-30, Arun feedback on the first build): fixed the new
  testing project not appearing in the list until reload (optimistic
  insert, now returns/shows the real included-case count immediately).
  Steps are now entered as discrete, addable/removable inputs rather than
  one free-text box, rendered as a numbered list wherever shown once
  there's more than one. Test-case URLs render as real links (opening on
  `kalendar.kaminolabs.dev`, not this admin portal). Added `category`/
  `subcategory` (free text, not a fixed taxonomy — same pattern as
  `priority`), `expected_result` (what should happen, distinct from the
  steps), and `automatable` (flags a future-automation candidate) to
  `kalendar_test_cases` (`schema_subset_021.sql`, folded into
  `schema_001.sql` — NOT yet run against the live DB). Testing-project
  creation, and the checklist view itself, can now filter by category/
  subcategory in addition to priority — "a workable testing plan" per
  Arun's ask, e.g. scoping a session to just Bonos/high-priority cases.
  Also added a stable `seq_no` (generated-identity column, distinct from
  the uuid `id`) so the bulk-import/export round-trip can UPDATE an
  existing case by `seq_no` instead of always inserting a duplicate on
  re-import, and so two exports are diffable by `seq_no` to see exactly
  what changed — Arun's own stated reason for wanting it.
- REPO SNAPSHOT (2026-09-30, Arun): `docs/test-cases/test-cases.md` is a
  git-tracked handoff copy of the catalog — same pipe-delimited format
  the bulk-import box reads and "Download all (.md)" exports, so it's
  always directly re-importable. `docs/test-cases/README.md` documents
  the convention: before overwriting `test-cases.md` with a new version,
  back up the current one into `docs/test-cases/history/` first, named
  `test-cases-<UTC-timestamp>.md`, so there's a real history of how the
  catalog changed over time, not just whatever `git log` shows. Initial
  137-case catalog (from a full repo scan of every `done`/`in_progress`
  workflow step) landed there as the first version.
- DESIGN SETTLED (2026-09-30, Arun, voice memo — brainstorm, not yet
  built). A manual regression-testing tracker, living in the admin portal
  as its own new sidebar section (separated by a divider, same pattern the
  dev-only tools already use at the bottom of `components/admin/
  sidebar.tsx`) — NOT a support/ticketing feature, purely for Arun to run
  himself through a checklist after a batch of changes.
- **Two-level model**:
  1. **Test case templates** — a reusable catalog, each with: title/steps
     (what to do), a URL to go to (or none — "use any generic page" is a
     valid case), test data to use (free text, or none = "use generic
     data"), and a priority Arun assigns himself: `low` / `medium` /
     `high` / unranked (default). Templates live independently of any one
     testing run — edited/added to over time, not recreated per project.
  2. **Testing projects** — a named batch Arun starts before a testing
     session ("dedicate one afternoon"). Created by picking which
     templates to include, filtered by priority — "all" (every priority
     including unranked) is today's only real option and should be the
     default, but the picker should support narrowing by priority since
     that's clearly where this is headed. Creating a project snapshots in
     which templates are included as a checklist; each item starts
     untested and Arun marks it `successful` / `unsuccessful` as he goes
     (a third "not yet tested" state, even though the UI only surfaces a
     binary pass/fail action — needed so the checklist can show progress).
     Explicitly NOT scoped for v1: richer per-result detail (notes,
     screenshots, bug links) — Arun flagged this as a later addition, not
     now.
- **Two ways templates get populated**:
  1. **Manual CRUD** — an admin page ("Test cases") to add/edit a
     template by hand, set its priority.
  2. **Bulk-generated** — Arun will separately ask a future session to
     scan the whole main repo and produce a full test-case catalog
     covering the app's scope, which he then uploads/imports here.
     EXPLICITLY NOT PART OF THIS STEP'S BUILD — Arun was clear this is a
     later, separate ask ("not now"). This step should still make the
     bulk-import path itself easy (e.g. paste/import a batch of cases in
     one action) so that future catalog has somewhere to land, but
     generating the catalog's actual content is out of scope here.
- **Automating test execution** (running these checks without a human
  clicking through them) is explicitly a future idea, not part of this
  step — noted so a later session doesn't try to scope it in.
- Data model, TO DECIDE AT BUILD TIME (not settled in the voice memo):
  whether a testing project's checklist rows hold a live reference to the
  template (simplest — project detail just joins against the current
  template row) or a snapshot of the template's fields at the time the
  project was created (protects a testing project's history if a template
  is later edited or removed) — lean toward live reference for v1 given
  how lightweight everything else here is meant to be, but flagging since
  it affects the schema shape.
- Cross-repo note: this is entirely admin-repo code/schema (its own new
  `kalendar_test_cases`/`kalendar_testing_projects`/(junction) tables) —
  same shape as this file's other admin-portal steps, tracked here per
  this repo's centralized-workflow-tracking convention.

## Notes / Deviations
- All admin portal pages are worth spot-checking for the same mobile-table pattern as schema-reset-tool, since this may not be an isolated instance (e.g. customer-overview and orphaned-bookings likely also render tabular data) — flagging for a future pass rather than assuming it's fixed by fixing schema-reset alone.
