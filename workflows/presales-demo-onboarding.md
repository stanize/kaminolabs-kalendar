# Workflow: Presales Demo Onboarding

Sales strategy: Arun researches a prospective clinic's public website, builds out a fully-populated demo account himself (their real business name, team, services), shows it to them, and — if they like it — sends a special signup link + code that migrates the demo into their own real account under their own email.

## Step: demo-account-creation
Status: in_progress
Criteria:
- PENDING TESTING (2026-09-18, verified against code): fully built —
  app/api/internal/provision-demo-account/route.ts (secret-gated internal
  endpoint) creates a real Better Auth user with emailVerified: true,
  inserts kalendar_businesses with is_demo/demo_created_at/demo_source_url
  (supabase/schema_001.sql:263+), and populates team members, services,
  and hours. Matches nearly all criteria below (account creation, full
  population, is_demo distinguishing flag, no booking data populated). No
  admin-UI caller or evidence of real use found yet, so `in_progress`
  (pending testing) not `done`.
- Arun can create a clinic account through the normal sign-up flow using a dummy/internal email he controls, then populate it fully (Negocio, Servicios, Equipo, Disponibilidad) using data researched from the prospect's real public website
- Demo accounts are somehow distinguishable from real clinic accounts internally (e.g. a is_demo flag or a naming convention on the dummy email) — needed so demo-account-lifecycle (below) and admin-account-cleanup.md's monthly sweep don't collide (a demo account is intentional, not abandoned, and must not be treated as a stray unconfirmed account)
- No booking/calendar activity is populated in the demo unless deliberately intended to migrate forward — see account-migration-execution's scope question below

## Step: presales-code-generation
Status: done
Criteria:
- CORRECTED (2026-09-20, verified against code — this step was stale at
  not_started, actually fully built on the admin side): the workflow file
  hadn't been updated when this shipped. Live in kaminolabs-kalendar-admin:
  `kalendar_presales_codes` table (main repo's supabase/schema_001.sql,
  `business_id`, `code`, `status: active|used|revoked`, `expires_at`,
  `used_at`, `used_by_user_id`) + lib/admin/presales.ts
  (generatePresalesCode/revokePresalesCode/listDemoBusinesses) +
  components/admin/demo-accounts-table.tsx (per-demo-business admin UI:
  generate/copy/revoke, shows the link, 14-day expiry, one active code per
  business — generating a new one revokes the prior one).
- Arun can generate a presales code tied to one specific demo account (single-use, not reusable across multiple prospects or multiple attempts once consumed)
- Code + a signup link are sent to the prospect by Arun directly (email, or whatever channel) — not through Kalendar's own automated email system, consistent with skipping email verification for this path (Arun himself is vouching for the recipient's identity by sending it to them directly)
- Code has some form of expiry or manual revocation, so a stale/unused code can't be used to hijack a demo weeks later after the deal fell through
- Link format ALREADY SETTLED by the admin-side implementation:
  `https://kalendar.kaminolabs.dev/onboarding?mode=demo-migration&code=XXXX-XXXX`
  — migration-signup-flow below must match this exact route/param shape,
  it's not still an open choice.
- GAP: the main app has ZERO handling of this yet — no /onboarding route
  exists at all (verified 2026-09-20, grepped for "demo-migration" and
  "kalendar_presales_codes" across app/ and lib/, no matches). The admin
  side was built ahead of the receiving side. migration-signup-flow,
  account-migration-execution, and post-migration-first-login below are
  what closes this gap.

## Step: migration-signup-flow
Status: not_started
Criteria:
- DESIGN SETTLED (2026-09-20, Arun): route is `/onboarding` (doesn't exist
  yet), reading `?mode=demo-migration&code=XXXX-XXXX` — matches the exact
  shape the admin side already generates (presales-code-generation), not
  still an open choice.
- Code is validated server-side against `kalendar_presales_codes` before
  showing the signup form: exists, `status = 'active'`, not past
  `expires_at`. Invalid/expired/already-used code shows a clear error
  screen, never silently falls through to a normal sign-up.
- Once validated, shows a real signup form (email/password or Google —
  same options as normal /signup), with the code carried along as a
  hidden field/query param, not retyped by the prospect.
- requireEmailVerification is bypassed specifically for this path (session
  goes live immediately, no verification-gate blocking screen) — since the
  code itself, sent directly by Arun to a person he's been in contact
  with, is treated as sufficient identity verification for this one flow.
- Normal sign-up path (no code) is completely unaffected — this is an
  additive mode, not a change to default sign-up behavior.
- On successful account creation, proceeds straight to
  account-migration-execution below (same request/page load, not a
  separate step the person has to trigger).

## Step: account-migration-execution
Status: not_started
Criteria:
- DESIGN SETTLED (2026-09-20, Arun) — RE-PARENT, NOT COPY: originally
  scoped as "a genuine copy under the new owner_id" (see superseded note
  below) — corrected after checking the actual schema.
  `kalendar_businesses.owner_id` is a single column (references
  `"user"(id)`); kalendar_services/kalendar_team_members/
  kalendar_business_hours all hang off `business_id`, not the owner. So
  migration is just transferring ownership of the EXISTING business row,
  not copying rows into a new one:
  `update kalendar_businesses set owner_id = :new_user_id, is_demo =
  false, demo_migrated_at = now() where id = :demo_business_id`, plus
  marking the presales code `status = 'used'`, `used_at = now()`,
  `used_by_user_id = :new_user_id`. All in one transaction/request.
- Scope: STRUCTURAL ONLY (Arun confirmed, matching this step's original
  recommendation) — Negocio/Servicios/Equipo/Disponibilidad. Never
  applicable to calendar/booking data since a demo account has none
  (demo-account-creation's own criteria: "No booking/calendar activity is
  populated in the demo"). Re-parenting naturally achieves this anyway —
  there's nothing booking-shaped to selectively include or exclude.
- Slug: KEPT AUTOMATICALLY (Arun confirmed) — a direct consequence of
  re-parenting instead of copying. The business row never moves, so its
  slug is untouched and there's no collision to resolve against a
  freshly-generated one. Exactly what the prospect saw during the demo is
  what they end up with.
- SUPERSEDED: the seed-snapshot-take/restore reuse question below no
  longer applies — that mechanism does a genuine copy (a different
  problem: undoing a destructive full-DB reset), whereas this step turned
  out to need a re-parent of one existing row instead. Kept for history.
- ~~On successful migration sign-up, the new real account's business
  (Negocio/Servicios/Equipo/Disponibilidad) is populated from the demo
  account's data — not a shared row, a genuine copy under the new
  owner_id, since the demo account may be reused as a template or
  eventually deleted independently~~
- ~~Loosely mirrors the existing seed-snapshot-take/restore pattern (per
  Arun's established multi-session framework: snapshot → restore under a
  new owner) — worth checking whether that mechanism is directly reusable
  here rather than building parallel migration logic~~

## Step: post-migration-first-login
Status: not_started
Criteria:
- DESIGN SETTLED (2026-09-20, Arun) — SYNCHRONOUS, one request: the
  re-parent above is a couple of UPDATE statements, not a bulk copy, so
  it's genuinely fast — no background job, no polling. The "fancy
  migration screen" plays for at least a floor duration (so it doesn't
  flash instantly even though the DB work finishes in milliseconds) while
  that one request is in flight, then redirects to /panel.
- ANIMATION CONCEPT (Arun): a clinic being built out of building blocks —
  a visual metaphor for "your account is being assembled," not a generic
  spinner. Needs actual visual/motion design work at build time; this
  criteria entry just captures the concept brief, not a finished spec.
- On landing at /panel after migration, the owner sees the NORMAL,
  fully-populated panel home (stats widgets visible) — never the empty-
  state onboarding checklist (booking-page-live's panel-home-gating
  widgets), since setup is already done via account-migration-execution.
  Confirm panel-home-gating's own completion checks (services/team/hours
  populated) naturally read as "complete" post-migration without needing
  a special-cased flag — they should, since the data really is there, but
  worth an explicit check at build time.
- ~~If migration is genuinely synchronous (fast, done before the page
  renders), this may just be a brief real loading state rather than a
  polled background job — depends on how heavy account-migration-
  execution's actual copy operation turns out to be~~ — RESOLVED: it is
  synchronous, per the settled design above.

## Step: demo-account-lifecycle
Status: not_started
Criteria:
- Demo accounts that are never migrated (prospect said no, or went cold) need an explicit disposal policy — hard deletion after some period, distinct from admin-account-cleanup.md's unconfirmed-account sweep (a demo account IS confirmed/intentional, so that cleanup job's "unconfirmed for 1 month" rule doesn't naturally catch it)
- CLARIFIED (2026-09-20, Arun) — what "post-migration disposal" actually
  means, now that account-migration-execution is a re-parent, not a copy:
  the BUSINESS never needs disposing (it's now the real account's
  business, done). What's left over is the ORPHANED DEMO BETTER AUTH USER
  (the @kaminolabs.dev account) — still holds the 'clinic' role, owns no
  business anymore post-migration. Arun's call: leave it, let
  admin-account-cleanup.md's sweep catch it later — that job is itself
  still not_started, so in practice this orphan sits indefinitely until
  that sweep is built. Not a blocker for building the migration flow
  itself, just a known follow-up dependency, same shape as
  no-self-service-dual-role-accounts' manual-role-grant-tool dependency
  on admin-portal-tools.md.
- Once a demo account has been successfully migrated, decide whether the original demo account is deleted, reset for reuse as a template, or left dormant — leaving it live indefinitely with a prospect's researched business data sitting in it is the risk case to avoid — RESOLVED for the migrated case per the bullet above (the business itself isn't a lingering risk anymore, only the empty demo user account is, and that's deliberately deferred).

## Notes / Deviations
- Data-provenance concern worth keeping in mind through this whole workflow: a demo account contains a real business's name/team/services scraped from their public site before they've agreed to anything. This isn't a blocker, but it's the reason demo-account-lifecycle needs a real disposal policy rather than being an afterthought.
- Current scraper→provisioning coverage matches exactly what the real onboarding wizard collects: Negocio (name/type/address/contact), Servicios (name/duration/price), Equipo (owner + additional practitioners), Disponibilidad (hours). Nothing beyond that is written to the real business tables, since the real product schema has no fields for them yet.
- Future nice-to-have, not scoped or started: WhatsApp number and social links (Facebook/Instagram/etc.) — the scraper already captures these in the draft's raw JSON today, they're just not surfaced/provisioned anywhere yet. Would need actual product fields (e.g. on kalendar_businesses or a booking-page-facing table) before these could be more than draft-only data, since demo accounts don't get schema real accounts don't have. Revisit if/when a real product need for displaying these on the booking page comes up.
