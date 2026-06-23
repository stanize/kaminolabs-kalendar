# Kalendar

Online booking software for Spanish-market professionals — psychologists, nutritionists, physiotherapists, beauty centres, fitness trainers, coaches, tutors, and similar service businesses. The product UI is in Spanish; this documentation is in English.

> **Current scope: onboarding only.** This repo contains the landing page and the 6-step onboarding wizard. The practitioner dashboard and the live public booking page are future features — minimal stubs are included so wizard-end links don't break.

---

## Tech stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styles | Tailwind CSS v4 — design tokens via `@theme` in `app/globals.css` |
| Auth + DB | Supabase (`@supabase/ssr`) — email/password + Google OAuth, Postgres |
| Wizard state | Zustand with `sessionStorage` persistence |
| Icons | lucide-react |
| Fonts | Bricolage Grotesque (headings) + Plus Jakarta Sans (UI) via `next/font/google` |

---

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You need a configured Supabase project before the wizard can save anything. Follow [`supabase/SETUP.md`](./supabase/SETUP.md) — it covers creating the project, running the schema, enabling Google OAuth, and configuring redirect URLs.

---

## Project structure

```
app/
  page.tsx                    Landing page — "Empezar gratis" links to /onboarding
  onboarding/page.tsx         Onboarding wizard entry point
  auth/callback/route.ts      OAuth callback — exchanges code for Supabase session
  panel/page.tsx              Dashboard stub (future feature)
  [slug]/page.tsx             Public booking page stub (future feature)

components/
  ui/                         Primitives: Icon, Logo, Avatar, Btn, Field
  landing/                    Navbar
  onboarding/                 6 step components, split shell, live booking preview

lib/
  onboarding/                 Types, reference data, slug helper, Zustand store, validation
  supabase/                   Browser client, server client, session middleware
  actions/onboarding.ts       Server Action — persists everything on wizard completion
  landing/                    Example business data for the landing preview cards

supabase/
  schema.sql                  Full database schema (tables + RLS + trigger)
  SETUP.md                    Step-by-step Supabase project configuration guide
```

---

## How the onboarding flow works

A 6-step linear wizard using the **split-screen shell** as the sole layout: brand panel + live booking preview on the left, scrollable form on the right. Step content lives in isolated `step-*.tsx` components so the other two shells from the design handoff (centred wizard, full-screen conversational) can be added later without rewriting anything.

**Deferred account creation.** To avoid forcing email verification mid-wizard, the actual Supabase account is **not created at step 1** — credentials are validated locally. Everything (account + business + services + hours + team) is written to the database in a single Server Action call when the user clicks "Crear mi página" at the end.

**Exception: Google OAuth.** Clicking "Continuar con Google" triggers a real OAuth redirect immediately (unavoidable). Wizard state is persisted to `sessionStorage` via Zustand's `persist` middleware so nothing is lost during the round-trip. On return, the controller detects the active session, pre-fills name/email, and jumps to step 2.

**Unique slug.** The business name is slugified (`lib/onboarding/slug.ts`) and claimed in `finishOnboarding`. If the slug already exists, the action retries with `-2`, `-3`, etc. up to 25 attempts.

**Key lesson from earlier prototypes:** never call `reset()` on the store before snapshotting the data you need for the success screen. The controller captures `dFinal` and `slugFinal` into local React state *before* calling `reset()` — the success screen reads from that snapshot, not the store.

---

## Database tables

All tables are prefixed with `kalendar_` for clean identification in the Supabase dashboard.

| Table | Purpose |
|---|---|
| `kalendar_profiles` | User profile, auto-created on sign-up via trigger |
| `kalendar_businesses` | Business/practice — holds the public slug and branding |
| `kalendar_services` | Bookable services (name, duration, price) |
| `kalendar_business_hours` | Weekly availability, one row per day |
| `kalendar_team_members` | Staff who deliver the services |

---

## What is not built (intentionally out of scope)

- Real practitioner dashboard (stub only)
- Live public booking page with calendar (stub only)
- Password recovery / email verification resend
- Client-facing bookings, notifications, payments

---

## Design notes

Single theme ("Clínico", light) and single brand colour (`#0d9488` teal). All tokens live in `app/globals.css`. The original design bundle included a theme/brand/style picker (`tweaks-panel.jsx`) — per the handoff README, that was a prototype-only tool, not a product feature, so it isn't included here. If per-business white-labelling is added later, all tokens are in one place to make it easy.

The proxy file (`proxy.ts`) uses the Next.js 16 naming convention — `middleware.ts` is deprecated in Next 16 in favour of `proxy.ts` with a named `proxy` export.
