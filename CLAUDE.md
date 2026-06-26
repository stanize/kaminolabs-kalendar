# Kalendar — Claude Context

## Project Overview
Kalendar is a SaaS online booking platform targeting Spanish-market professionals (psychologists, nutritionists, physiotherapists, beauty centers, fitness trainers, coaches, tutors, etc.).

- **Repo**: stanize/kaminolabs-kalendar
- **Production URL**: https://kalendar.kaminolabs.dev
- **Stack**: Next.js 16 + TypeScript + Tailwind CSS v4 (App Router) + Zustand + Supabase (DB only) + Better Auth

---

## Architecture

### Auth — Better Auth
- **Provider**: Better Auth with Google OAuth only (no email/password)
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

## Onboarding Wizard (`/onboarding`)

6 steps: `cuenta → negocio → servicios → horario → equipo → listo`

- **Step 0 (cuenta)**: Google-only sign-in. No email form. No Continuar button.
- **Step 1 (negocio)**: Shows personalised `¡Hola, [first name]!` greeting using name from Better Auth session.
- **Steps 1–4**: Have a "Más tarde" skip button (with `Redirigiendo…` loading state) that calls `skipOnboarding()` server action, sets `onboarding_skipped_at` on `kalendar_profiles`, then redirects to `/panel`.
- **State**: Zustand store persisted to `sessionStorage` (`lib/onboarding/store.ts`)
- **Key pattern**: Snapshot `dFinal` and `slugFinal` into local state before calling `reset()` — never reset before reading store data needed for the success screen.

### Routing guards
- `/onboarding` → redirects to `/panel` if valid Better Auth session exists (verifies user in DB)
- `/panel` → redirects to `/onboarding` if no session

---

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

1. Run in Supabase SQL editor: `DELETE FROM "user" WHERE email = 'user@example.com';`  
   (cascades automatically to `account`, `session`, `verification`)
2. Clear browser cookies for `kaminolabs.dev`

Both steps required for a clean reset.

---

## Known Decisions & Rationale

- **Better Auth over Supabase Auth**: Supabase Auth custom domain requires paid plan ($25/mo). Better Auth runs inside Next.js, uses our domain natively — Google consent screen shows `kaminolabs.dev`.
- **Supabase for DB only**: Keeps data ownership and avoids vendor lock-in on auth.
- **Google OAuth only**: Simplifies auth flow for Spanish market professionals. Email/password may be added later.
- **sessionStorage for Zustand**: Survives Google OAuth redirect round-trip but clears when tab closes.
- **`onboarding_skipped_at` flag**: Nullable timestamp — NULL means completed, timestamp means skipped. Drives the "complete your setup" banner in the panel.
