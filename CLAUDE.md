# Kalendar — Claude Context

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
- **Tables**: `user`, `session`, `account`, `verification` (no RLS — Better Auth managed)
- **Google OAuth app name**: "Kalendar by Kaminolabs"
- **Callback URI**: `https://kalendar.kaminolabs.dev/api/auth/callback/google`
- **Route handler**: `app/api/auth/[...all]/route.ts`
- **Server client**: `lib/auth.ts` (uses pg Pool + DATABASE_URL)
- **Browser client**: `lib/auth-client.ts` (createAuthClient)
- **Session helpers**: `lib/auth-session.ts` — `getSession()` (React `cache()`-deduped per request), `requireSession()` (throws `UnauthorizedError` when absent), and the `UnauthorizedError` class
- **Action wrapper**: `lib/auth-action.ts` — `authedAction(handler)` injects a verified session as the guaranteed first arg (this file must stay free of `"use server"`)
- Supabase is used for DB only — never for auth

### Database — Supabase
- **Project ID**: rlxfcmijbesoblissmtd
- **Connection**: Transaction pooler only — `aws-1-eu-central-1.pooler.supabase.com:6543`
- Direct connection (port 5432) is blocked on Vercel free plan — always use pooler
- **Kalendar tables** (all prefixed `kalendar_`): `kalendar_businesses`, `kalendar_services`, `kalendar_business_hours`, `kalendar_team_members`, `kalendar_support_tickets`. There is **no** `kalendar_profiles` table — all per-user identity (id, name, email, `emailVerified`) comes from Better Auth's `user` table via `session.user`.
- **Auth tables** (owned by Better Auth, created by `npx @better-auth/cli migrate`, **not** in `schema_001.sql`): `user`, `session`, `account`, `verification`

### Design System
- **Fonts**: Bricolage Grotesque (display) + Plus Jakarta Sans (UI)
- **Brand color**: `#0d9488` (teal)
- **Tokens**: Tailwind v4 `@theme inline` in `app/globals.css`
- **Language**: Spanish throughout (UI copy, variable names where applicable)

---

## Onboarding (`/onboarding`) — sign-up only

The multi-step wizard was removed. `/onboarding` is now a simple sign-up screen:

- **Component**: `components/auth/signup-form.tsx` (mirrors `components/auth/login-form.tsx`), rendered by `app/onboarding/page.tsx` in a centered layout.
- **Google sign-up** → `callbackURL: "/panel"`. Email is pre-verified, so the panel loads with no gate.
- **Email sign-up** → `authClient.signUp.email({ ..., callbackURL: "/panel" })`, then `router.push("/panel")`. A session is created immediately; the verification email is sent automatically; the panel shows the blocking confirmation gate until the user verifies.
- Business/services/schedule/team data collection is **no longer part of sign-up** — it will move to a separate in-panel setup flow (the panel home already shows a setup checklist that gracefully reflects an empty account).

### Routing guards
- `/onboarding` → redirects to `/panel` if a valid session exists
- `/panel` → redirects to `/login` if no session; if signed in but email unverified, renders the verification gate over the panel

### Removed files
`components/onboarding/{onboarding-flow,step-cuenta,step-negocio,step-servicios,step-horario,step-equipo,step-listo,nav-buttons,split-shell}.tsx`, `lib/onboarding/{store,validation}.ts`, `lib/actions/{onboarding,skip-onboarding}.ts`.

### Kept (still used by landing + public booking pages)
`components/onboarding/booking-preview.tsx`, `lib/onboarding/{data,types,slug}.ts` — imported by `app/page.tsx`, `app/bookings/[slug]/page.tsx`, and `lib/landing/ejemplos.ts`.


## Panel (`/panel`)

- **Layout**: `app/panel/layout.tsx` — sidebar + main content
- **Sidebar**: `components/panel/sidebar.tsx` — full Spanish nav, user info, Cerrar sesión
- **Nav items** (Spanish labels / English routes): Inicio `/panel`, Calendario `/panel/calendar`, Clientes `/panel/clients`, Negocio `/panel/business`, Servicios `/panel/services`, Disponibilidad `/panel/availability`, Equipo `/panel/team`, Pagos `/panel/payments`, Facturas `/panel/invoices`, Emails y avisos `/panel/notifications`, Informes `/panel/reports`, Integraciones `/panel/integrations`, Ajustes `/panel/settings`
- **Home page**: Setup checklist with progress bar (Negocio, Servicios, Disponibilidad, Equipo), booking page link, quick access shortcuts

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

---

## Business settings & public booking

- **First in-panel setup page is built**: `/panel/business` ("Configura tu negocio"; sidebar label "Negocio")
  manages the single business record (name, type, city, slug). Page:
  `app/panel/business/page.tsx` (server, `requireSession` + `getSetupProgress`);
  form: `components/panel/business-form.tsx` (`BusinessForm`) (client). Each setup-checklist
  block maps to its own sidebar nav item + page, built one block at a time; Negocio
  is the first. **Return-intent pattern**: links from the home page (`/panel`)
  carry `?from=home` (checklist items today, dashboard widgets later). The target
  page reads it and, after a successful PRIMARY mutation, redirects back to
  `/panel`; direct nav from the sidebar (no param) stays put. Secondary mutations
  (edit/delete/reorder) never redirect. Negocio redirects on any successful save
  when `from=home`; Servicios redirects only on the FIRST service added (0->1
  transition) when `from=home`. Server actions in
  `lib/actions/business.ts`: `saveBusinessSettings` (create/update) and
  `checkSlugAvailability` (live UX check) — both wrapped in `authedAction`.
- **Public booking pages live under `/bookings/[slug]`** (moved from root
  `/[slug]`). The namespace prevents slug/route collisions. Route:
  `app/bookings/[slug]/page.tsx`, which renders only when `slug_status='active'`.
- **Booking URL helper** (`lib/business/booking-url.ts`): `bookingPath(slug)`,
  `bookingUrl(slug)`, `bookingUrlDisplay(slug)` — the single source of truth for
  the public URL shape (`{NEXT_PUBLIC_APP_URL}/bookings/{slug}`). Never hardcode
  the domain or `/bookings` segment anywhere; call these. (Old code wrongly used
  a `kalendar.app/...` placeholder — all removed.)
- **Slug rules** (`lib/business/slug-screen.ts`): lowercase a-z/0-9/hyphens,
  3-40 chars, no leading/trailing/double hyphens; sanitized live as typed.
  Suggestion is hyphenated from the business name (`suggestSlug`).
- **Slug is permanent**: chosen once at creation, then **immutable** — the form
  shows it read-only on edit, and `saveBusinessSettings` ignores any slug in the
  payload on update. Changing a slug is a future support-handled operation.
- **Slug moderation (model C+)**: every slug is human-reviewed regardless. At
  creation an automated screen (`reserved-slugs.ts` blocklist + a small profanity
  list) runs: clean slugs go live instantly (`slug_status='active'`) but still
  enter the review queue (`slug_reviewed_at` null); flagged slugs start
  `pending_review` (offline until approved). Statuses:
  `active|pending_review|rejected`. Columns on `kalendar_businesses`:
  `slug_status`, `slug_flag_reason`, `slug_reviewed_at`, `slug_reviewed_by`.
  Review queue = `slug_reviewed_at IS NULL`. The future admin portal owns review.
- **Reserved slugs** (`lib/business/reserved-slugs.ts`): vanity/abuse blocklist
  (admin, support, kalendar, official, api, app, login, billing, ...), extend over time.

### Servicios (second in-panel setup page, BUILT)
Route `/panel/services` (label "Servicios"), heading "Tus servicios". Manages the
business's services (name, duration_min, price — no other fields yet; more in
later releases). Server page `app/panel/services/page.tsx` (redirects to
`/panel/business?from=home` if no business yet). Client component
`components/panel/services-manager.tsx`: list with native HTML5 drag-reorder
(persists immediately via `reorderServices`), inline add/edit editor, and a
templates picker shown only when the user has zero services. Editor: name; a
duration preset row (15/30/45/60/90/120 + "Otra" custom, bounded 5-120 min); a
**price slider 0-100 € synced with an editable number box** — the box is the
source of truth and the slider clamps to its max when the price exceeds 100
(whole euros, no decimals, 0 = "Gratis"). Templates come from
`SERVICE_TEMPLATES[businessType]` (`[name, duration_min, price]`). **Template flow
(customize-before-confirm)**: the user multi-selects templates, hits
"Personalizar N" to stage them as pre-filled, individually-removable editable
draft cards (reusing the shared `ServiceFields`), tweaks each, then "Confirmar N"
bulk-saves the EDITED values via `createServices`. "Cancelar" discards; removing
all drafts returns to the picker; the manual "Añadir servicio" button is hidden
while staging. Reads: `getServicesForUser(userId)` in
`lib/services/data.ts` (resolves business via owner_id, scopes by business_id).
Constraints/validation in `lib/services/constants.ts`. Server actions in
`lib/actions/services.ts` (all `authedAction`, all scope by the caller's
business_id): `createService`, `createServices` (bulk), `updateService`,
`deleteService`, `reorderServices`; each revalidates `/panel` + `/panel/services`.

## Key Conventions

- **Internationalization-ready — English-only code, no exceptions.** Every code
  identifier, route path, file/folder name, table/column name, enum value, stored
  code (business `type`, weekday `day`), slug, comment, and script is in English. (The icon registry export is `ICONS`, renamed from the former Spanish `ICONOS`.)
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
- **New mutations**: Wrap in `authedAction` from `lib/auth-action.ts` — `export const createX = authedAction(async (session, input) => { ... })`. The verified session is the guaranteed first arg, so there is no path into the body that skips the check. (`authedAction` throws `UnauthorizedError`. The existing `support` / `onboarding` / `skip-onboarding` actions instead **return** a graceful Spanish `{ ok: false, error }`, so they keep their own inline `getSession()` check and are intentionally not wrapped — wrapping would change their error contract.)
- **Reads in server components**: Plain query functions taking `userId` as a required first arg — `getServices(userId)` — scoping every query by it (e.g. `.eq("owner_id", userId)`). Obtain the id via `requireSession()` (already guaranteed by the layout). The required parameter is what makes "scope to current user" impossible to forget; there is no unscoped overload to call by accident.
- **Never trust client-passed user IDs** — always derive from the session.
- **DB queries**: Always use `createClient()` from `lib/supabase/server.ts` in server components/actions
- **Icons**: Add new icons to `components/ui/icon.tsx` ICONOS registry before using
- **Copy**: All UI copy in Spanish

---

## Testing — Deleting Test Users

Every `kalendar_*` table with a user-scoped column has an `ON DELETE CASCADE` FK
to `"user"(id)` (defined in `schema_001.sql`), so deleting a user removes all of their data.

1. Run in Supabase SQL editor: `DELETE FROM "user" WHERE email = 'user@example.com';`
   Cascades to: `account`, `session`, `verification` (Better Auth) **and**
   `kalendar_support_tickets`, `kalendar_businesses`
   → `kalendar_services` / `kalendar_business_hours` / `kalendar_team_members`.
2. Clear browser cookies for `kaminolabs.dev`.

Both steps required for a clean reset.

### Full database reset (wipe all users)
One-off, destructive — run in the Supabase SQL editor:

```sql
truncate
  public.kalendar_support_tickets,
  public.kalendar_team_members,
  public.kalendar_business_hours,
  public.kalendar_services,
  public.kalendar_businesses,
  public."account",
  public."session",
  public."verification",
  public."user"
restart identity cascade;
```

Storage files in `support-attachments` are not removed by the truncate above;
clear them separately if needed:
`delete from storage.objects where bucket_id = 'support-attachments';`

## Migrations

- `schema_001.sql` — single consolidated schema. Drops and recreates all
  `kalendar_*` tables (businesses, services, hours, team, support
  tickets), the support enums, the `set_updated_at` trigger, and the
  `support-attachments` storage bucket. Applied by pasting the whole file into
  the Supabase SQL editor. There are no incremental migration files — when the
  schema changes, edit this file and re-run it (destructive: it drops first).
- **Migration order matters**: run `npx @better-auth/cli migrate` FIRST (creates `user`/`session`/`account`/`verification`), THEN run `schema_001.sql` — the Kalendar tables have cascade FKs to `public."user"(id)` and will fail if `user` does not yet exist.

---

## Known Decisions & Rationale

- **Better Auth over Supabase Auth**: Supabase Auth custom domain requires paid plan ($25/mo). Better Auth runs inside Next.js, uses our domain natively — Google consent screen shows `kaminolabs.dev`.
- **Supabase for DB only**: Keeps data ownership and avoids vendor lock-in on auth.
- **Auth: Google OAuth + email/password**: Email/password requires email confirmation, enforced as a panel-level UI gate (not via `requireEmailVerification`, which would block the user from ever reaching the gate).
- **sessionStorage for Zustand**: Survives Google OAuth redirect round-trip but clears when tab closes.
