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
Login, sign-up, password reset, session handling, role assignment.

- Routes: `app/api/auth/[...all]/route.ts`, `app/signin/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`
- Components: `components/auth/login-form.tsx`, `components/auth/signup-form.tsx`, `components/auth/patient-login-form.tsx`, `components/auth/forgot-password-form.tsx`, `components/auth/reset-password-form.tsx`
- Lib: `lib/auth.ts`, `lib/auth-client.ts`, `lib/auth-session.ts`, `lib/auth-action.ts`, `lib/roles/*`
- Proxy/middleware: `proxy.ts`
- DB tables: `user`, `session`, `account`, `verification` (Better Auth, in `schema_better_auth_001.sql`), `user_roles` (in `schema_001.sql`)
- Depends on shared infra: i18n (`public.ts` dictionary), email (`lib/email.ts` — verification + reset-password emails)
- Gotchas: `lib/auth-action.ts` must stay free of `"use server"`. `schema_better_auth_001.sql` must run before `schema_001.sql` (no longer via `npx @better-auth/cli migrate`). `requireEmailVerification: false` — verification gate is UI-side (see panel-shell). Password reset: `authClient.requestPasswordReset({ email, redirectTo })` → Better Auth emails a link to its own `/api/auth/reset-password/:token` route, which 302s the browser to `redirectTo` (`/reset-password`) with `?token=...` (or `?error=INVALID_TOKEN`) — the app never builds that link itself, only renders whatever Better Auth hands `sendResetPassword` in `lib/auth.ts`. Token expires in 1h (`resetPasswordTokenExpiresIn`); resetting revokes all other sessions (`revokeSessionsOnPasswordReset: true`). Patients don't have password reset yet — email/password patient accounts would need this extended (see `patient-portal`).

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

- Routes: `app/patient/(protected)/page.tsx`, `app/patient/(protected)/layout.tsx`, `app/patient/(protected)/bookings/page.tsx`, `app/patient/login/page.tsx`
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
- Components: `components/panel/sidebar.tsx`, `components/panel/email-verification-gate.tsx`, `components/panel/setup-complete-banner.tsx`, `components/panel/editable-greeting-name.tsx`
- Actions: `lib/actions/support.ts`, `lib/actions/account.ts`
- Data: `lib/account/data.ts` (getPreferredName)
- DB tables: `kalendar_support_tickets`, `kalendar_user_preferences`
- i18n: `lib/i18n/dictionaries/panel-shell.ts`
- Gotchas: clinic role assignment happens idempotently on every panel visit (in the layout) — self-heals Google OAuth + schema resets. BUT the layout first checks `getUserRoles`: a user holding `patient` and NOT `clinic` is redirected to `/patient` instead of being auto-granted `clinic` — role is sticky from first sign-up, so a patient-only account never gets promoted just by landing on `/panel` (e.g. via the clinic `/login` form or a Google OAuth callback, both of which always target `/panel`). Dual-role accounts (both `patient` and `clinic`) are a future feature, not yet handled — currently they always land in the panel. Support screenshot upload goes to Supabase Storage bucket `support-attachments`. Home greeting shows an editable "preferred name" (`kalendar_user_preferences.preferred_name`), a soft display name distinct from the account's Better Auth `user.name` — falls back to the account name's first word, then to a plain "Inicio"/"Home" fallback with no prefix.

---

## Module: panel-business
"Negocio" — the business record (name, type, legal ID, address, contact, slug).

- Routes: `app/panel/business/page.tsx`
- Components: `components/panel/business-form.tsx`
- Lib: `lib/business/data.ts`, `lib/business/reserved-slugs.ts`, `lib/business/slug-screen.ts`, `lib/business/booking-url.ts` (shared — see public-booking), `lib/business/postal-codes.ts` + `postal-codes-es.json` (static ~11k-entry Spanish postal-code → city/province dataset, free, no external API), `lib/business/phone-country-codes.ts` (static curated dialing-code list, Spanish labels, defaults to +34)
- Actions: `lib/actions/business.ts` (includes `lookupPostalCode`, a thin authed wrapper around the static dataset)
- DB tables: `kalendar_businesses`
- i18n: `lib/i18n/dictionaries/business.ts`, `business-types.ts`
- Gotchas: slug is PERMANENT after creation — form shows read-only on edit, `saveBusinessSettings` ignores slug on update. Slug moderation: clean slugs go `active` instantly but sit in a review queue (`slug_reviewed_at IS NULL`); flagged ones go `pending_review`. Postal-code autofill only fills city/province when BOTH are still empty (never overwrites something the user already typed); the dataset sometimes uses bilingual province names (e.g. "Araba/Álava") since the source is bilingual for some autonomous communities — fields stay fully editable. `address_country` is free text, defaults to "España" client-side for new businesses only. Phone is stored as two columns, `phone_country_code` (defaults `+34`) and `phone_number` — UI shows a country-code dropdown (`lib/business/phone-country-codes.ts`, static list) beside the number field.

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
- Components: `components/panel/team-manager.tsx`, `components/panel/availability-manager.tsx`, `components/panel/availability-setup-wizard.tsx` (first-setup steps 1–2), `components/panel/time-select.tsx` (shared HH:MM dropdown)
- Lib: `lib/team/*`, `lib/availability/*`
- Actions: `lib/actions/team.ts`, `lib/actions/availability.ts`
- DB tables: `kalendar_team_members`, `kalendar_business_hours`
- i18n: `lib/i18n/dictionaries/team.ts`, `availability.ts`
- Gotchas: `team_mode` (`solo`|`team`) lives on `kalendar_businesses`, not on the team table. `ensureOwnerSeeded` idempotently inserts owner as a team member. Availability save is an atomic whole-week replace. Per-member overrides are deferred/future — don't assume they exist. First-time availability setup (`hasSavedHours === false`) runs a 3-step wizard: days → standard hours → review; the review step is the normal editor grid pre-filled by fanning the standard hours out to each selected day (defaults: Mon–Fri, 09:00–13:00/14:00–18:00 in `SETUP_DEFAULT_*`). There is deliberately NO linked-template concept — after fan-out every day is independent; the wizard is only a fast entry path and never shows again once hours are saved.

---

## Module: panel-calendar
"Calendario" — owner-facing view of upcoming/pending bookings.

- Routes: `app/panel/calendar/page.tsx`
- Components: `components/panel/calendar-bookings.tsx`
- Lib: `lib/booking/owner-data.ts`
- Actions: `lib/actions/booking-owner.ts`
- DB tables: `kalendar_bookings` (read + status updates), reads `kalendar_patients`
- i18n: `lib/i18n/dictionaries/calendar.ts`
- Gotchas: "Pendientes" tab is the guest-booking review queue — flat list (no day grouping), sorted soonest-expiry-first via `pendingExpiryAt`, with a live `CountdownBadge` (re-renders every 60s). `confirmBookingAsOwner` (in `lib/actions/booking-owner.ts`) transitions `pending_confirmation` → `confirmed`, clears the expiry window, and emails the guest a confirmation receipt in their locale — see cron module for the separate sweep that expires (rather than confirms) stale pending bookings.

---

## Shared infra (not a module — cross-cutting, used by multiple modules above)

- **i18n mechanism**: `lib/i18n/config.ts`, `lib/i18n/server.ts`, `lib/actions/locale.ts`. Cookie: `kalendar_locale`. One dictionary file per module (see each module's "i18n" line above). If a module needs new UI strings, add to its own dictionary file — don't create a new mechanism.
- **Email**: `lib/email.ts` (Resend REST API, no SDK). Used by: auth (verification), public-booking (confirm/cancel/owner-notify), future reminders/reschedule.
- **Cron**: `app/api/cron/sweep-expired-bookings/route.ts` (Vercel Cron). Touches `kalendar_bookings` — relevant to public-booking and panel-calendar.
- **Supabase client**: `lib/supabase/*` — service-role key, used by every module for DB writes.
- **Schema**: `supabase/schema_001.sql` (all `kalendar_*` tables + `user_roles`), `supabase/schema_better_auth_001.sql` (Better Auth tables). Any module adding/changing a table edits `schema_001.sql` directly (destructive, re-run convention).
- **Onboarding leftovers**: `lib/onboarding/{data,types,slug}.ts` — larger dependency surface than the name suggests. `lib/onboarding/types.ts` exports `DayId` and `BusinessType`, which have become de facto shared types: imported by `lib/availability/{constants,data}.ts`, `lib/booking/data.ts`, `lib/booking/slots.ts`, `lib/business/data.ts`, `lib/actions/{business,availability}.ts`, and the `availability.ts`/`business-types.ts` i18n dictionaries. `lib/onboarding/data.ts` exports `SERVICE_TEMPLATES` and `BUSINESS_TYPES`, used by `app/panel/services/page.tsx`, `lib/actions/business.ts`, and `app/page.tsx`. `lib/landing/ejemplos.ts` imports `OnboardingData`. (`app/bookings/[slug]/page.tsx` does not import onboarding directly — only transitively via `lib/booking/slots.ts`.) Not a live module; don't add to it — but `DayId`/`BusinessType` are good candidates for promotion to a real shared-types location in a future cleanup pass, since half the app now depends on a folder named for a feature that no longer exists as such.

---

## Not yet modularized / doesn't exist yet

These appear in `CLAUDE.md` or memory as planned but were NOT found in the repo as of
the last resync — don't assume they exist without checking: `/panel/clients`,
`/panel/notifications`, `/panel/payments`, `/panel/invoices`, `/panel/reports`,
`/panel/integrations`, `/panel/settings`. When one of these gets built, add a new
module section above.

---

_Last resynced: 2026-07-10_
