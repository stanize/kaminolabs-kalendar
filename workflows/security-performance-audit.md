# Workflow: Security, IP & Production Performance Audit (Pre-Launch)

A one-shot audit pass across DB security, code/IP protection, and production
performance/scalability — surfaced by Arun (2026-09-27) as a pre-launch gap:
nothing in this repo has systematically checked the Supabase RLS/grant
posture, app-layer authorization boundary, or production perf readiness
before the first real clinic goes live. Distinct from `error-monitoring.md`
(observability/alerting gap) and `legal-compliance.md` (ToS/privacy copy
gap) — this is a security + performance code/config audit.

Cross-reference `docs/security/vulnerabilities.md` (existing tracker,
V-001–V-009) before starting — new findings from this audit continue that
numbering (V-010+) rather than duplicating it. Performance findings get
their own `P-001+` numbering (this audit introduces that prefix; no
existing performance tracker predates it).

## Step: run-audit
Status: not_started
Criteria:
- SURFACED (2026-09-27, Arun, via uploaded brief
  `kalendar-security-performance-audit.md`) as a "before going live"
  checklist item — not yet executed. The full brief (verbatim) is below;
  a future session picks this up and runs it as its own dedicated pass
  (not folded into unrelated feature work), verifying every claim against
  the actual code/Supabase config rather than trusting prior notes.
- Scope: `stanize/kaminolabs-kalendar` (primary), plus
  `stanize/kaminolabs-kalendar-admin` and `stanize/kaminolabs-pdfs` where
  the brief calls them out.
- Ground rules from the brief (binding for whichever session runs this):
  read `CLAUDE.md`/`MODULES.md` first; verify every claim against real
  code/config, not assumption; **never run DDL against Supabase directly**
  — any schema/policy fix goes into `schema_001.sql` + a new
  `schema_subset_00N.sql` per this repo's migration convention, Arun
  applies it; read-only SQL (`execute_sql`) and Supabase advisors
  (`get_advisors`) are fine for inspection; deliver the report **in chat
  first** — only push code fixes, or add findings to
  `docs/security/vulnerabilities.md`, once Arun explicitly confirms; give
  a short critical-review (tradeoffs/edge cases/alternatives) before
  recommending any fix; cross-reference V-001–V-009 and don't duplicate.
- Expected output (per the brief): an executive summary (top 3 pre-launch
  fixes), a findings table (V-010+ for security, P-001+ for performance;
  severity, evidence, fix, effort), a "cleared concerns" list (checked and
  found fine, with evidence), proposed fixes for Critical/High items
  (SQL-file content or code diffs, never applied directly), and a
  non-code checklist for Arun (plan upgrades, 2FA, PAT hygiene, trademark,
  GDPR page, backups).
- Full brief follows verbatim (kept intact rather than summarized further,
  since it's itself the detailed checklist the audit session should work
  through):

---

<!-- BEGIN VERBATIM BRIEF -->

# Kalendar: Security, IP and Production Performance Audit Brief

**Purpose:** a brief for a Claude Code session. Analyse the real codebase and infrastructure of Kalendar against the concerns below. Confirm or clear each one with evidence from the code or config, and produce a prioritised findings report.

**Repos in scope**
- `stanize/kaminolabs-kalendar` (main app, `kalendar.kaminolabs.dev`), which is the primary scope
- `stanize/kaminolabs-kalendar-admin` (admin portal)
- `stanize/kaminolabs-pdfs` (PDF portal)

**Stack:** Next.js 16 + TypeScript + Tailwind v4 + Zustand + Supabase (DB only) + Better Auth + Vercel (Hobby plan) + Resend + Stripe. Supabase project `rlxfcmijbesoblissmtd`. The DB is reached via the Transaction pooler only.

---

## Ground rules for the session

1. Read `CLAUDE.md` and `MODULES.md` first.
2. **Verify every claim against the actual code.** Everything in this brief comes from project notes and conversation, not from a code read. If the code shows otherwise, say so plainly.
3. **Never run DDL against Supabase directly.** Any schema or policy fix goes into SQL files only (`schema_001.sql` plus a new `schema_subset_00N.sql`, following the dual-write rule). Arun applies them.
4. Read-only SQL (`execute_sql`) and Supabase advisors (`get_advisors`) are fine for inspection.
5. Deliver the report **in chat first**. Only push, or add to `docs/security/vulnerabilities.md`, when Arun explicitly confirms.
6. Before recommending any fix, give a short critical review of it: tradeoffs, edge cases, alternatives.
7. Cross-reference existing entries V-001 to V-009 in `docs/security/vulnerabilities.md`. Mark new findings as V-010 onward and don't duplicate existing ones.

---

## Part 1: Database security

### Context: the known architectural risk
- All DB access uses the **service-role key**, because Better Auth issues no Supabase JWT.
- **RLS is enabled but permissive.** The real authorisation boundary is the app layer (`authedAction` HOF in `lib/auth-action.ts`, `requireSession()` in `lib/auth-session.ts`).
- Better Auth tables (`user`, `session`, `account`, `verification`) have **no RLS**.
- Supabase automatically exposes every `public` table through its REST API (PostgREST). Anyone with the project URL and anon/publishable key can call that API directly and **bypass the app layer entirely**.

**Worst case to rule out:** the `anon` role can `SELECT` from `session`, `account` or `verification`. That would leak session tokens and OAuth tokens, allowing account takeover of any clinic.

### 1.1 Exposure of tables to anon/authenticated roles (CRITICAL)
- [ ] List every table in `public` with its RLS status and policies:
  ```sql
  select schemaname, tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
  select schemaname, tablename, policyname, roles, cmd, qual, with_check from pg_policies where schemaname = 'public';
  ```
- [ ] Check table privileges granted to `anon` and `authenticated`:
  ```sql
  select table_name, grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon','authenticated')
  order by table_name, grantee;
  ```
- [ ] Flag any policy with `qual = true` or `with_check = true` for `anon`/`authenticated`/`public` roles.
- [ ] Specifically confirm whether `user`, `session`, `account` and `verification` are readable or writable by `anon`.
- [ ] Check `public` functions/RPCs callable by `anon` (e.g. `reverse_bono_session`, `seed_snapshot_take`, `seed_snapshot_restore`, any `SECURITY DEFINER` functions):
  ```sql
  select p.proname, p.prosecdef, has_function_privilege('anon', p.oid, 'execute') as anon_can_exec
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public';
  ```
- [ ] Check the `seed_snapshot_*` mirror tables and the `storage.buckets` / `storage.objects` policies (PDF storage, invoice PDFs).
- [ ] **Recommended fix direction** (to evaluate, not implement blindly): deny-all RLS for `anon` and `authenticated`, and/or revoke `anon`/`authenticated` grants on `public` tables and functions. The service role bypasses RLS, so the app is unaffected. Also confirm nothing in the browser relies on the anon client.

### 1.2 Key handling
- [ ] Grep the code for Supabase client creation. Confirm the **service-role key is only used server-side** (never imported into a `"use client"` file or a module reachable from one).
- [ ] Confirm no secret sits in a `NEXT_PUBLIC_*` env var (service role, `CRON_SECRET`, Stripe secret, Resend key, Better Auth secret, internal provisioning secret).
- [ ] Check whether the anon/publishable key is shipped to the browser at all. If it isn't needed, say so. Revoking its privileges is then zero-cost.
- [ ] Check `.env*` files aren't committed, and check git history for leaked secrets (`git log -p | grep -iE "service_role|sk_live|sk_test|re_[A-Za-z0-9]"`, or use gitleaks/trufflehog if available).

### 1.3 App-layer authorisation (the real boundary)
- [ ] List **every server action and API route**. Confirm each one is wrapped in `authedAction` / `requireSession()` or is intentionally public, and justify the public ones.
- [ ] For each authed action, confirm **ownership checks**: queries must scope by the session user's business (e.g. `business_id` derived from the session, never from client input). Look for IDOR: an action taking `bookingId`/`serviceId`/`memberId`/`invoiceId` from the client and updating it without verifying it belongs to the caller's business.
- [ ] Confirm that no client-passed `userId` is trusted (project rule).
- [ ] Public surfaces: `/bookings/[slug]` wizard, guest booking, the cancel link, `.ics`, the clinic landing contact form (`kalendar_contact_messages`), and the PDF portal `GET /d/{id}?token=`. Check:
  - token entropy and expiry, and that tokens aren't guessable/sequential
  - rate limiting / IP cooldown coverage (spam bookings, contact-form spam, email bombing via reminders)
  - the Turnstile CAPTCHA toggle design: does it actually protect the right endpoints when armed?
- [ ] Secret-gated endpoints: `POST /api/internal/provision-demo-account`, the cron endpoints (`CRON_SECRET`), and the Stripe webhook. Confirm constant-time secret comparison, and **Stripe signature verification** on the webhook.
- [ ] Admin portal: confirm the `kalendar_admin_users` allowlist is enforced **server-side on every admin route/action**, not just in the UI. Pay special attention to the schema-reset tool and the date cycler (destructive operations).
- [ ] Patient portal vs clinic panel: confirm role separation (a patient session cannot call panel actions).

### 1.4 Auth configuration (Better Auth)
- [ ] Session cookie flags: `HttpOnly`, `Secure`, `SameSite`, and domain scope (cookies are on `kaminolabs.dev`. Could another `*.kaminolabs.dev` app read or overwrite them?).
- [ ] Password policy, login rate limiting, and account-enumeration leaks on login/signup/forgot-password responses.
- [ ] Note that `requireEmailVerification: false` is set, but the notes also mention an "email verification gate". Clarify which is true in code and the implications.
- [ ] CSRF posture for server actions and API routes.

### 1.5 Web security headers
- [ ] Check `next.config`, `proxy.ts` and `vercel.json` for CSP, HSTS, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy` and `Permissions-Policy`.
- [ ] Look for any `dangerouslySetInnerHTML` or unsanitised HTML in emails/PDF templates (XSS or template injection via clinic-controlled fields like business name or service descriptions).
- [ ] Puppeteer PDF rendering: can user-controlled content make the headless browser fetch internal/external URLs (SSRF)?

### 1.6 Dependencies
- [ ] `npm audit --omit=dev` on each repo. Report high/critical issues only, with whether they're actually reachable.

### 1.7 Operational / GDPR
- [ ] Confirm the Supabase project region (should be EU for GDPR).
- [ ] Note that clinics (psychology, physio, nutrition) may store **special-category health data** under GDPR. Identify which fields could hold it (booking notes, client notes, service names) and flag it for the pending legal/GDPR page.
- [ ] Backups: current Supabase plan and backup/PITR availability. Recommend a plan before real clinic data arrives.
- [ ] Recommend 2FA on GitHub, Supabase, Vercel, Google Cloud (OAuth), Stripe and Resend (checklist item for Arun, not verifiable from code).

---

## Part 2: Code / IP protection

### Context
- All repos are private. Server code is never sent to the browser. The client JS bundle is public (minified but readable).
- Arun regularly pastes GitHub PATs into Claude sessions.

### Checks
- [ ] Identify **business logic that lives in client components** and would be visible in the browser bundle: pricing/discount engine, slot engine (`lib/booking/slots.ts`), invoice numbering, bono logic. Flag anything sensitive that could move server-side.
- [ ] Confirm production source maps are **not publicly served** (`productionBrowserSourceMaps` in `next.config`). Public source maps would expose readable source.
- [ ] Check for secrets, internal URLs or admin endpoints referenced in client code.
- [ ] Check that a `LICENSE` file (proprietary / all rights reserved) exists in each repo.
- [ ] Recommendations checklist for Arun (non-code):
  - Use **fine-grained PATs**: single repo, minimal scopes, 7–30 day expiry. Revoke old tokens regularly.
  - Enable 2FA on GitHub and Vercel.
  - Add Terms of Service with an anti-reverse-engineering clause.
  - Consider registering the "Kalendar" trademark (OEPM/EUIPO) after a conflict search. It's a common name.
  - The real moat is Spain-specific features (facturas, bonos, Spanish-first UX), clinic relationships and iteration speed. Code secrecy is secondary.

---

## Part 3: Production performance (no lag, no delays)

### Context
- Vercel serverless scales the app automatically, so no manual load balancing is needed. **Postgres is the likely bottleneck.**
- Currently on **Vercel Hobby** (non-commercial use per Vercel's terms, as far as known; verify) and probably the **Supabase free plan** (pauses inactive projects, small compute, limited backups).
- DB access goes through the Transaction pooler. Reminders run via pg_cron every 15 minutes.

### 3.1 Region co-location (likely biggest single win)
- [ ] Find the Supabase project region and the Vercel function region (`vercel.json` `regions`, or project settings via the Vercel MCP).
- [ ] If they differ (e.g. Vercel default `iad1` US East vs Supabase in the EU), quantify it: every query pays a transatlantic round trip. Recommend pinning Vercel functions to the Supabase region.

### 3.2 Query efficiency
- [ ] Run Supabase **Performance Advisor** (`get_advisors` type performance) and report unindexed foreign keys, unused indexes, etc.
- [ ] Check indexes on hot paths:
  - bookings by `business_id` + start time range (calendar week/day/month views, slot engine conflict checks)
  - reminder cron query (bookings due in the next 24h/1h window, not yet reminded)
  - slug lookup on public booking pages
  - availability by business/member
  - invoices by business + year (sequential numbering)
- [ ] Look for **N+1 queries**: loops issuing a query per item (e.g. per team member, per day, per booking in calendar rendering or report generation).
- [ ] Look for over-fetching (`select('*')` on wide tables where a few columns are needed) and unbounded queries without date limits or pagination (clients list, bono usage report, bookings list).
- [ ] If `pg_stat_statements` is available, list the top queries by total and mean execution time.

### 3.3 Rendering and caching
- [ ] Public booking page `/bookings/[slug]`: what's dynamic vs cacheable? Business info, services and team change rarely and could be cached/revalidated. Slots must stay fresh.
- [ ] Check `getSession()` dedupe via React `cache()` is used consistently (no repeated session lookups per request).
- [ ] Check bundle size of the heaviest client routes (calendar grid, booking wizard). Flag large dependencies loaded on the public booking path (it runs on clinics' patients' phones).
- [ ] Middleware (`proxy.ts`): confirm it does no DB calls on every request, or quantify the cost if it does.

### 3.4 Background work and external calls
- [ ] Reminder cron: confirm it's batched and idempotent, won't double-send on overlap, and handles Resend rate limits.
- [ ] Emails sent inline during a booking request: does the user wait on Resend/PDF generation? Recommend moving slow side-effects out of the request path where it matters.
- [ ] PDF rendering (Puppeteer + @sparticuz/chromium): cold-start and memory cost. Confirm render-and-cache avoids re-rendering.

### 3.5 Concurrency / correctness under load
- [ ] Double booking: two patients booking the same slot at the same instant. Is there a DB-level guard (unique constraint / exclusion constraint / transaction with a lock) or only an app-level check?
- [ ] Invoice numbering under concurrency: can two invoices get the same number or leave gaps? Spanish factura rules require a correlative sequence.
- [ ] Bono session deduction/reversal: atomic under concurrent requests?

### 3.6 Monitoring and readiness (recommendations checklist)
- [ ] Plan upgrades before paying clinics: Vercel Pro and Supabase Pro. Verify current pricing and terms.
- [ ] Error tracking (e.g. Sentry), Vercel Speed Insights/Analytics, uptime monitoring on the public booking page and the cron health (e.g. Better Stack / UptimeRobot).
- [ ] Alerting on pg_cron failures (`cron.job_run_details` status ≠ succeeded).
- [ ] Propose a simple **load-test plan** (e.g. k6): ~50 clinics concurrently loading calendars and ~200 patients booking. Identify the first thing that breaks. Don't run it against production without Arun's approval.

---

## Expected output

A single report delivered in chat, structured as:

1. **Executive summary:** 5–10 lines. Overall posture and the top 3 things to fix before the first clinic goes live.
2. **Findings table:** ID (V-010+ for new security items, P-001+ for performance) | Area | Severity (Critical/High/Medium/Low) | Evidence (file:line or SQL result) | Recommended fix | Effort (S/M/L).
3. **Cleared concerns:** items from this brief checked and found fine, with the evidence.
4. **Proposed fixes:** for Critical/High items, the concrete change (SQL file content for policy/grant changes, code diffs for app changes), each with a short tradeoff note.
5. **Arun's non-code checklist:** plan upgrades, 2FA, PAT hygiene, trademark, GDPR page, backups.

Don't push anything or edit `vulnerabilities.md` until Arun confirms.

<!-- END VERBATIM BRIEF -->
