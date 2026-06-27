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
- **Kalendar tables** (all prefixed `kalendar_`): `kalendar_profiles`, `kalendar_businesses`, `kalendar_services`, `kalendar_business_hours`, `kalendar_team_members`

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
`components/onboarding/booking-preview.tsx`, `lib/onboarding/{data,types,slug}.ts` — imported by `app/page.tsx`, `app/[slug]/page.tsx`, and `lib/landing/ejemplos.ts`.


## Panel (`/panel`)

- **Layout**: `app/panel/layout.tsx` — sidebar + main content
- **Sidebar**: `components/panel/sidebar.tsx` — full Spanish nav, user info, Cerrar sesión
- **Nav items**: Inicio, Calendario, Clientes, Servicios, Disponibilidad, Equipo, Pagos, Facturas, Emails y avisos, Informes, Integraciones, Ajustes
- **Home page**: Setup checklist with progress bar (Negocio, Servicios, Disponibilidad, Equipo), booking page link, quick access shortcuts
- **Setup banner**: Shows when `onboarding_skipped_at` is set on `kalendar_profiles` — prompts user to complete setup

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
| `RESEND_API_KEY` | Resend API key for verification emails (without it, emails are skipped/logged, not sent) |
| `EMAIL_FROM` | Sender, e.g. `Kalendar <no-reply@kaminolabs.dev>` (domain must be verified in Resend) |

---

## Key Conventions

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

After applying `supabase/schema_003.sql`, every `kalendar_*` table has an
`ON DELETE CASCADE` FK to `"user"(id)`, so deleting a user removes all of their data.

1. Run in Supabase SQL editor: `DELETE FROM "user" WHERE email = 'user@example.com';`
   Cascades to: `account`, `session`, `verification` (Better Auth) **and**
   `kalendar_profiles`, `kalendar_support_tickets`, `kalendar_businesses`
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
  public.kalendar_profiles,
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

- `schema_001.sql` — base schema (profiles, businesses, services, hours, team)
- `schema_002.sql` — support tickets
- `schema_003.sql` — cascade user deletion to all Kalendar data; corrects
  `kalendar_profiles.id` from `uuid` to `text` to match Better Auth's `user.id`

---

## Known Decisions & Rationale

- **Better Auth over Supabase Auth**: Supabase Auth custom domain requires paid plan ($25/mo). Better Auth runs inside Next.js, uses our domain natively — Google consent screen shows `kaminolabs.dev`.
- **Supabase for DB only**: Keeps data ownership and avoids vendor lock-in on auth.
- **Auth: Google OAuth + email/password**: Email/password requires email confirmation, enforced as a panel-level UI gate (not via `requireEmailVerification`, which would block the user from ever reaching the gate).
- **sessionStorage for Zustand**: Survives Google OAuth redirect round-trip but clears when tab closes.
- **`onboarding_skipped_at` flag**: Nullable timestamp — NULL means completed, timestamp means skipped. Drives the "complete your setup" banner in the panel.
