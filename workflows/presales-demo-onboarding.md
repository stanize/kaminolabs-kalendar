# Workflow: Presales Demo Onboarding

Sales strategy: Arun researches a prospective clinic's public website, builds out a fully-populated demo account himself (their real business name, team, services), shows it to them, and — if they like it — sends a special signup link + code that migrates the demo into their own real account under their own email.

## Step: demo-account-creation
Status: not_started
Criteria:
- Arun can create a clinic account through the normal sign-up flow using a dummy/internal email he controls, then populate it fully (Negocio, Servicios, Equipo, Disponibilidad) using data researched from the prospect's real public website
- Demo accounts are somehow distinguishable from real clinic accounts internally (e.g. a is_demo flag or a naming convention on the dummy email) — needed so demo-account-lifecycle (below) and admin-account-cleanup.md's monthly sweep don't collide (a demo account is intentional, not abandoned, and must not be treated as a stray unconfirmed account)
- No booking/calendar activity is populated in the demo unless deliberately intended to migrate forward — see account-migration-execution's scope question below

## Step: presales-code-generation
Status: not_started
Criteria:
- Arun can generate a presales code tied to one specific demo account (single-use, not reusable across multiple prospects or multiple attempts once consumed)
- Code + a signup link are sent to the prospect by Arun directly (email, or whatever channel) — not through Kalendar's own automated email system, consistent with skipping email verification for this path (Arun himself is vouching for the recipient's identity by sending it to them directly)
- Code has some form of expiry or manual revocation, so a stale/unused code can't be used to hijack a demo weeks later after the deal fell through

## Step: migration-signup-flow
Status: not_started
Criteria:
- Sign-up page supports a distinct mode/flag (e.g. ?mode=demo-migration or a dedicated route) that requires a presales code as a mandatory field alongside the normal email/password or Google sign-up
- Code is validated against presales-code-generation's record before the account is created — invalid/expired/already-used code blocks sign-up with a clear error, doesn't silently fall through to a normal sign-up
- requireEmailVerification is bypassed specifically for this path (session goes live immediately, no verification-gate blocking screen) — since the code itself, sent directly by Arun to a person he's been in contact with, is treated as sufficient identity verification for this one flow
- Normal sign-up path (no code) is completely unaffected — this is an additive mode, not a change to default sign-up behavior

## Step: account-migration-execution
Status: not_started
Criteria:
- On successful migration sign-up, the new real account's business (Negocio/Servicios/Equipo/Disponibilidad) is populated from the demo account's data — not a shared row, a genuine copy under the new owner_id, since the demo account may be reused as a template or eventually deleted independently
- Migration scope decision needed: does this ever include calendar/booking data, or only the structural setup (services, team roster, hours)? Recommend structural-only, given the demo was built with dummy/researched data, not real appointments — copying fake calendar activity into a clinic's first real account risks confusing them or leaking demo-only content
- Slug handling decided: does the new account get the demo's slug (if the demo was built at a guessable/expected slug matching the clinic's real name) or generate a fresh one? If the demo's slug was already shown to the prospect during the demo, reusing it avoids a mismatch between what they were shown and what they end up with
- Loosely mirrors the existing seed-snapshot-take/restore pattern (per Arun's established multi-session framework: snapshot → restore under a new owner) — worth checking whether that mechanism is directly reusable here rather than building parallel migration logic

## Step: post-migration-first-login
Status: not_started
Criteria:
- On first login after a successful migration, the new owner sees a loading/progress indicator ("your account is being set up") instead of the normal onboarding checklist (booking-page-live's panel-home-gating widgets) — since setup is already done, showing the empty-state checklist would be confusing/wrong
- Once migration completes, the owner lands on a normal, fully-populated panel home (stats widgets visible, matching the completed-checklist state from clinic-onboarding.md's panel-home-gating)
- If migration is genuinely synchronous (fast, done before the page renders), this may just be a brief real loading state rather than a polled background job — depends on how heavy account-migration-execution's actual copy operation turns out to be

## Step: demo-account-lifecycle
Status: not_started
Criteria:
- Demo accounts that are never migrated (prospect said no, or went cold) need an explicit disposal policy — hard deletion after some period, distinct from admin-account-cleanup.md's unconfirmed-account sweep (a demo account IS confirmed/intentional, so that cleanup job's "unconfirmed for 1 month" rule doesn't naturally catch it)
- Once a demo account has been successfully migrated, decide whether the original demo account is deleted, reset for reuse as a template, or left dormant — leaving it live indefinitely with a prospect's researched business data sitting in it is the risk case to avoid

## Notes / Deviations
- Data-provenance concern worth keeping in mind through this whole workflow: a demo account contains a real business's name/team/services scraped from their public site before they've agreed to anything. This isn't a blocker, but it's the reason demo-account-lifecycle needs a real disposal policy rather than being an afterthought.
- Current scraper→provisioning coverage matches exactly what the real onboarding wizard collects: Negocio (name/type/address/contact), Servicios (name/duration/price), Equipo (owner + additional practitioners), Disponibilidad (hours). Nothing beyond that is written to the real business tables, since the real product schema has no fields for them yet.
- Future nice-to-have, not scoped or started: WhatsApp number and social links (Facebook/Instagram/etc.) — the scraper already captures these in the draft's raw JSON today, they're just not surfaced/provisioned anywhere yet. Would need actual product fields (e.g. on kalendar_businesses or a booking-page-facing table) before these could be more than draft-only data, since demo accounts don't get schema real accounts don't have. Revisit if/when a real product need for displaying these on the booking page comes up.
