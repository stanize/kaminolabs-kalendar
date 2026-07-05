# Kalendar — Module Map

Purpose: let a Claude session scope to ONE module instead of reading the whole repo.
Usage: tell Claude "we're working on module `<name>`" — Claude reads this file, then
only the files listed for that module (plus anything under "Shared infra" that the
module depends on).

This file is a map, not a refactor. Next.js file-system routing means route files
physically stay where the framework requires; module boundaries here are logical/
documented, not folder-enforced.

Keep this file honest by running `RESYNC.md` periodically (see that file) — ideally
after every feature is shipped and tested, before starting the next one.

---

## Module: auth
Login, sign-up, session handling, role assignment.

- Routes: `app/api/auth/[...all]/route.ts`, `app/login/page.tsx`, `app/onboarding/page.tsx`
- Components: `components/auth/login-form.tsx`, `components/auth/signup-form.tsx`, `components/auth/patient-login-form.tsx`
- Lib: `lib/auth.ts`, `lib/auth-client.ts`, `lib/auth-session.ts`, `lib/auth-action.ts`, `lib/roles/*`
- Proxy/middleware: `proxy.ts`
- DB tables: `user`, `session`, `account`, `verification` (Better Auth, in `schema_better_auth_001.sql`), `user_roles` (in `schema_001.sql`)
- Depends on shared infra: i18n (`public.ts` dictionary), email (verification emails)
- Gotchas: `lib/auth-action.ts` must stay free of `"use server"`. `schema_better_auth_001.sql` must run before `schema_001.sql` (no longer via `npx @better-auth/cli migrate`). `requireEmailVerification: false` — verification gate is UI-side (see panel-shell).

---

## Module: public-booking
The public-facing booking wizard clients use to book an appointment.

- Routes: `app/bookings/[slug]/page.tsx`, `app/bookings/confirm/[token]/page.tsx`, `app/bookings/cancel/[token]/page.tsx`
- Components: `components/booking/booking-page-shell.tsx`, `components/booking/booking-wizard.tsx`, `components/booking/cancel-booking-button.tsx`
- Lib: `lib/booking/data.ts`, `lib/booking/slots.ts`, `lib/business/booking-url.ts` (shared — see below)
- Actions: `lib/actions/booking.ts`
- DB tables: `kalendar_bookings` (write path), reads `kalendar_businesses`, `kalendar_services`, `kalendar_team_members`, `kalendar_business_hours`
- i18n: `lib/i18n/dictionaries/booking-page.ts`, `booking-result.ts`
- Depends on shared infra: email (`lib/email.ts` — confirm/cancel/owner-notify emails), auth (patient login step inside wizard)
- Gotchas: `lib/business/booking-url.ts` is SHARED with panel-business (booking link display) — changes here affect both. Timezone hardcoded `Europe/Madrid` in `lib/booking/slots.ts`.

---

## Module: patient-portal
Patient-facing account area (separate from the clinic panel).

- Routes: `app/patient/page.tsx`, `app/patient/layout.tsx`, `app/patient/login/page.tsx`, `app/patient/bookings/page.tsx`
- Lib: `lib/booking/patient-data.ts`
- Actions: `lib/actions/patient.ts`
- DB tables: `kalendar_patients`, reads `kalendar_bookings`
- Depends on shared infra: auth (Google OAuth self-heal in `app/patient/layout.tsx`), i18n
- Gotchas: `provisionPatient` assigns patient role AND upserts `kalendar_patients` — don't split these without checking both call sites.

---

## Module: panel-shell
Panel-wide chrome: sidebar, layout, home checklist, support form. Not a single
feature — this is the "frame" all panel-* modules render inside.

- Routes: `app/panel/layout.tsx`, `app/panel/page.tsx`, `app/panel/support/page.tsx`
- Components: `components/panel/sidebar.tsx`, `components/panel/email-verification-gate.tsx`, `components/panel/setup-complete-banner.tsx`
- Actions: `lib/actions/support.ts`
- DB tables: `kalendar_support_tickets`
- i18n: `lib/i18n/dictionaries/panel-shell.ts`
- Gotchas: clinic role assignment happens idempotently on every panel visit (in the layout) — self-heals Google OAuth + schema resets. BUT the layout first checks `getUserRoles`: a user holding `patient` and NOT `clinic` is redirected to `/patient` instead of being auto-granted `clinic` — role is sticky from first sign-up, so a patient-only account never gets promoted just by landing on `/panel` (e.g. via the clinic `/login` form or a Google OAuth callback, both of which always target `/panel`). Dual-role accounts (both `patient` and `clinic`) are a future feature, not yet handled — currently they always land in the panel. Support screenshot upload goes to Supabase Storage bucket `support-attachments`.

---

## Module: panel-business
"Negocio" — the business record (name, type, city, slug).

- Routes: `app/panel/business/page.tsx`
- Components: `components/panel/business-form.tsx`
- Lib: `lib/business/data.ts`, `lib/business/reserved-slugs.ts`, `lib/business/slug-screen.ts`, `lib/business/booking-url.ts` (shared — see public-booking)
- Actions: `lib/actions/business.ts`
- DB tables: `kalendar_businesses`
- i18n: `lib/i18n/dictionaries/business.ts`, `business-types.ts`
- Gotchas: slug is PERMANENT after creation — form shows read-only on edit, `saveBusinessSettings` ignores slug on update. Slug moderation: clean slugs go `active` instantly but sit in a review queue (`slug_reviewed_at IS NULL`); flagged ones go `pending_review`.

---

## Module: panel-services
"Servicios" — service catalog (name, duration, price).

- Routes: `app/panel/services/page.tsx`
- Components: `components/panel/services-manager.tsx`
- Lib: `lib/services/*`
- Actions: `lib/actions/services.ts`
- DB tables: `kalendar_services`
- i18n: `lib/i18n/dictionaries/services.ts`
- Gotchas: template flow is customize-before-confirm (multi-select → staged editable drafts → bulk confirm). `ServiceFields` type shared between editor and staged drafts.

---

## Module: panel-team-availability
"Equipo" + "Disponibilidad" — staff roster and working hours. Grouped together
because they're tightly coupled (availability can be per-member in the future).

- Routes: `app/panel/team/page.tsx`, `app/panel/availability/page.tsx`
- Components: `components/panel/team-manager.tsx`, `components/panel/availability-manager.tsx`
- Lib: `lib/team/*`, `lib/availability/*`
- Actions: `lib/actions/team.ts`, `lib/actions/availability.ts`
- DB tables: `kalendar_team_members`, `kalendar_business_hours`
- i18n: `lib/i18n/dictionaries/team.ts`, `availability.ts`
- Gotchas: `team_mode` (`solo`|`team`) lives on `kalendar_businesses`, not on the team table. `ensureOwnerSeeded` idempotently inserts owner as a team member. Availability save is an atomic whole-week replace. Per-member overrides are deferred/future — don't assume they exist.

---

## Module: panel-calendar
"Calendario" — owner-facing view of upcoming/pending bookings.

- Routes: `app/panel/calendar/page.tsx`
- Components: `components/panel/calendar-bookings.tsx`
- Lib: `lib/booking/owner-data.ts`
- Actions: `lib/actions/booking-owner.ts`
- DB tables: `kalendar_bookings` (read + status updates), reads `kalendar_patients`
- i18n: `lib/i18n/dictionaries/calendar.ts`
- Gotchas: "Pendientes" tab is the guest-booking review queue with expiry countdown (in progress — see cron module for the sweep that expires these).

---

## Shared infra (not a module — cross-cutting, used by multiple modules above)

- **i18n mechanism**: `lib/i18n/config.ts`, `lib/i18n/server.ts`, `lib/actions/locale.ts`. Cookie: `kalendar_locale`. One dictionary file per module (see each module's "i18n" line above). If a module needs new UI strings, add to its own dictionary file — don't create a new mechanism.
- **Email**: `lib/email.ts` (Resend REST API, no SDK). Used by: auth (verification), public-booking (confirm/cancel/owner-notify), future reminders/reschedule.
- **Cron**: `app/api/cron/sweep-expired-bookings/route.ts` (Vercel Cron). Touches `kalendar_bookings` — relevant to public-booking and panel-calendar.
- **Supabase client**: `lib/supabase/*` — service-role key, used by every module for DB writes.
- **Schema**: `supabase/schema_001.sql` (all `kalendar_*` tables + `user_roles`), `supabase/schema_better_auth_001.sql` (Better Auth tables). Any module adding/changing a table edits `schema_001.sql` directly (destructive, re-run convention).
- **Onboarding leftovers**: `lib/onboarding/{data,types,slug}.ts` — kept only because `app/page.tsx`, `app/bookings/[slug]/page.tsx`, and `lib/landing/ejemplos.ts` still import from them. Not a live module; don't add to it.

---

## Not yet modularized / doesn't exist yet

These appear in `CLAUDE.md` or memory as planned but were NOT found in the repo as of
the last resync — don't assume they exist without checking: `/panel/clients`,
`/panel/notifications`, `/panel/payments`, `/panel/invoices`, `/panel/reports`,
`/panel/integrations`, `/panel/settings`. When one of these gets built, add a new
module section above.

---

_Last resynced: 2026-07-05_
