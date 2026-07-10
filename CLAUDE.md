# Kalendar — Claude Context 

> **Per-feature detail lives in `MODULES.md`, not here.** This file covers only
> project-wide architecture that spans multiple modules (auth model, database,
> deploy, conventions). If you're working on one feature (business, services,
> team, availability, booking, patient portal, etc.), read `MODULES.md` first
> and jump to that module's section — don't expect it here.
>
> Keep this file and `MODULES.md` in sync via `RESYNC.md`.

## Project Overview
Kalendar is a SaaS online booking platform targeting Spanish-market professionals (psychologists, nutritionists, physiotherapists, beauty centers, fitness trainers, coaches, tutors, etc.).

- **Repo**: stanize/kaminolabs-kalendar
- **Production URL**: https://kalendar.kaminolabs.dev
- **Stack**: Next.js 16 + TypeScript + Tailwind CSS v4 (App Router) + Zustand + Supabase (DB only) + Better Auth

---

## Architecture

### Auth — Better Auth
- **Provider**: Better Auth — Google OAuth + email/password
- **Email verification**: required for email/password sign-ups. `requireEmailVerification` is **false** (a session is created on sign-up so the user reaches the panel), but the panel renders a full-screen blocking gate (`components/panel/email-verification-gate.tsx`) until `user.emailVerified` is true. Google sign-ups arrive pre-verified and never see the gate.
- **Verification email**: sent on sign-up via `emailVerification.sendVerificationEmail` in `lib/auth.ts` → `lib/email.ts` (Resend REST API, env-gated). `autoSignInAfterVerification: true`; link `callbackURL` is `/panel`.
- **Tables**: `user`, `session`, `account`, `verification` (no RLS — Better Auth managed), created by `supabase/schema_better_auth_001.sql` (no longer via `npx @better-auth/cli migrate`)
- **Google OAuth app name**: "Kalendar by Kaminolabs"
- **Callback URI**: `https://kalendar.kaminolabs.dev/api/auth/callback/google`
- **Route handler**: `app/api/auth/[...all]/route.ts`
- **Server client**: `lib/auth.ts` (uses pg Pool + DATABASE_URL)
- **Browser client**: `lib/auth-client.ts` (createAuthClient)
- **Session helpers**: `lib/auth-session.ts` — `getSession()` (React `cache()`-deduped per request), `requireSession()` (throws `UnauthorizedError` when absent), and the `UnauthorizedError` class
- **Action wrapper**: `lib/auth-action.ts` — `authedAction(handler)` injects a verified session as the guaranteed first arg (this file must stay free of `"use server"`)
- Supabase is used for DB only — never for auth
- Per-feature auth detail (patient login, panel role self-heal, onboarding routing guards) — see `MODULES.md` → `auth`, `panel-shell`, `patient-portal`.

### Database — Supabase
- **Project ID**: rlxfcmijbesoblissmtd
- **Connection**: Transaction pooler only — `aws-1-eu-central-1.pooler.supabase.com:6543`
- Direct connection (port 5432) is blocked on Vercel free plan — always use pooler
- **Kalendar tables** (all prefixed `kalendar_`): see `MODULES.md` for the current table-to-module map. There is **no** `kalendar_profiles` table — all per-user identity (id, name, email, `emailVerified`) comes from Better Auth's `user` table via `session.user`.
- **Auth tables** (owned by Better Auth, created by `schema_better_auth_001.sql`, **not** in `schema_001.sql`): `user`, `session`, `account`, `verification`

### Design System
- **Fonts**: Bricolage Grotesque (display) + Plus Jakarta Sans (UI)
- **Brand color**: `#0d9488` (teal)
- **Tokens**: Tailwind v4 `@theme inline` in `app/globals.css`
- **Language**: Spanish throughout (UI copy only — see Key Conventions)

### i18n
- Cookie-based (`kalendar_locale`), `es`/`en`. Mechanism: `lib/i18n/config.ts`, `lib/i18n/server.ts`, `lib/actions/locale.ts`.
- One dictionary file per module under `lib/i18n/dictionaries/` — see `MODULES.md` for which dictionary belongs to which module. Don't create a second i18n mechanism; add strings to the relevant module's dictionary file.

### Email
- `lib/email.ts` — Resend REST API (no SDK), env-gated on `RESEND_API_KEY` + `EMAIL_FROM`, degrades gracefully without them. Used by auth (verification) and public-booking (confirm/cancel/owner-notify) — see `MODULES.md` for the full list of emails each module sends.

### Cron
- `app/api/cron/sweep-expired-bookings/route.ts` (Vercel Cron). See `MODULES.md` → `public-booking` / `panel-calendar` for what it touches.

---

## Environment Variables (Vercel)

| Key | Description |
|-----|-------------|
| `DATABASE_URL` | Supabase Transaction pooler connection string |
| `BETTER_AUTH_SECRET` | Random 32+ char secret for Better Auth |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_APP_URL` | `https://kalendar.kaminolabs.dev` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key — used by `lib/supabase/server.ts` for all server-side DB access (bypasses RLS). Server-only, never exposed to the browser |
| `RESEND_API_KEY` | Resend API key for verification emails (without it, emails are skipped/logged, not sent) |
| `EMAIL_FROM` | Sender, e.g. `Kalendar <no-reply@kaminolabs.dev>` (domain must be verified in Resend) |
| `CRON_SECRET` | Bearer token Vercel sets automatically; used to authorize `app/api/cron/sweep-expired-bookings/route.ts` |

---

## Key Conventions (apply across ALL modules)

- **Internationalization-ready — English-only code, no exceptions.** Every code
  identifier, route path, file/folder name, table/column name, enum value, stored
  code (business `type`, weekday `day`), slug, comment, and script is in English.
  Spanish appears **only** in UI strings shown to the end customer, supplied as
  display labels mapped from English codes (e.g. `BUSINESS_TYPES` maps
  `psychology` -> `"Psicología"`, `DAYS` maps `mon` -> `"Lunes"`). The project
  must port to another country by swapping the label layer alone, with zero code
  changes. Business type codes: `psychology|nutrition|physiotherapy|beauty|fitness|coaching|tutoring|other`.
  Weekday codes: `mon|tue|wed|thu|fri|sat|sun`. Panel routes are English
  (`/panel/business`, `/panel/services`, `/panel/availability`, `/panel/team`, etc.).
  `/panel/settings` (label "Ajustes") is reserved for FUTURE app/account settings —
  the business record lives at `/panel/business`, not settings.
- **Middleware**: Must be named `proxy.ts` (not `middleware.ts`) with exported function `proxy` — Next.js 16 convention
- **Auth layering (two gates)**: The `/panel` layout (`app/panel/layout.tsx`) is a server-component UX gate — it redirects unauthenticated users and every nested route inherits it. It is **not** a security boundary: server actions are directly invocable, so each must verify auth itself. Because all DB access uses the Supabase service-role key (no RLS backstop), the app-level check is the *only* authorization boundary.
- **New mutations**: Wrap in `authedAction` from `lib/auth-action.ts` — `export const createX = authedAction(async (session, input) => { ... })`. The verified session is the guaranteed first arg, so there is no path into the body that skips the check. (`authedAction` throws `UnauthorizedError`. The `support` action instead **returns** a graceful Spanish `{ ok: false, error }`, so it keeps its own inline `getSession()` check and is intentionally not wrapped — wrapping would change its error contract.)
- **Reads in server components**: Plain query functions taking `userId` as a required first arg — `getServices(userId)` — scoping every query by it (e.g. `.eq("owner_id", userId)`). Obtain the id via `requireSession()` (already guaranteed by the layout). The required parameter is what makes "scope to current user" impossible to forget; there is no unscoped overload to call by accident.
- **Never trust client-passed user IDs** — always derive from the session.
- **DB queries**: Always use `createClient()` from `lib/supabase/server.ts` in server components/actions
- **Icons**: Add new icons to `components/ui/icon.tsx` ICONOS registry before using
- **Copy**: All UI copy in Spanish (except guest-facing emails/booking pages, which are locale-aware — see `MODULES.md` → `public-booking`)
- **Server→client serialization**: dictionary values crossing the boundary must be plain serializable data — never functions. Use placeholder-token strings + `.replace()`, not function fields.

---

## Testing — Deleting Test Users

Every `kalendar_*` table with a user-scoped column has an `ON DELETE CASCADE` FK
to `"user"(id)` (defined in `schema_001.sql`), so deleting a user removes all of their data.

1. Run in Supabase SQL editor: `DELETE FROM "user" WHERE email = 'user@example.com';`
2. Clear browser cookies for `kaminolabs.dev`.

Both steps required for a clean reset.

### Full database reset (wipe all users)
One-off, destructive — run in the Supabase SQL editor. Truncate every
`kalendar_*` table plus `account`, `session`, `verification`, `"user"` with
`restart identity cascade`. Check `schema_001.sql` for the current full table
list before running (it changes as modules add tables).

Storage files in `support-attachments` are not removed by truncate; clear
separately if needed: `delete from storage.objects where bucket_id = 'support-attachments';`

## Migrations

- `schema_001.sql` — single consolidated schema, destructive (drops and
  recreates all `kalendar_*` tables). No incremental migration files — when the
  schema changes, edit this file and re-run it.
- `schema_better_auth_001.sql` — single consolidated schema for Better Auth's `user`/`session`/`account`/`verification` tables.
- **Migration order matters**: run `schema_better_auth_001.sql` FIRST (creates `user`/`session`/`account`/`verification`), THEN run `schema_001.sql` — the Kalendar tables have cascade FKs to `public."user"(id)` and will fail if `user` does not yet exist.

---

## Known Decisions & Rationale

- **Better Auth over Supabase Auth**: Supabase Auth custom domain requires paid plan ($25/mo). Better Auth runs inside Next.js, uses our domain natively — Google consent screen shows `kaminolabs.dev`.
- **Supabase for DB only**: Keeps data ownership and avoids vendor lock-in on auth.
- **Auth: Google OAuth + email/password**: Email/password requires email confirmation, enforced as a panel-level UI gate (not via `requireEmailVerification`, which would block the user from ever reaching the gate).
- **sessionStorage for Zustand**: Survives Google OAuth redirect round-trip but clears when tab closes.
