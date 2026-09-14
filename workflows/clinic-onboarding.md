# Workflow: Clinic Onboarding

The path a new clinic/professional takes from sign-up to having a live, bookable public page.

## Step: sign-up
Status: done
Criteria:
- Sign-up form exists at /app/signup/page.tsx (components/auth/signup-form.tsx)
- Google OAuth sign-up available via Better Auth
- Email/password sign-up sends verification email (lib/auth.ts -> lib/email.ts)
- Session created immediately on sign-up (autoSignInAfterVerification / requireEmailVerification: false)
- No name field on the form — display name derived from email local-part (nameFromEmail) since Better Auth requires a name
- Landing-page hero email capture carries forward into the sign-up form (app/signup/page.tsx reads searchParams.email -> SignupForm initialEmail)
- Client-side email format validation (EMAIL_FORMAT_RE) blocks obviously malformed input (missing @, no domain, no dot) before account creation
- ACCEPTED BEHAVIOR (by design, not a bug): a syntactically valid but non-existent/undeliverable email (e.g. a typo'd domain) is still allowed to create an account. The user can simply sign up again with the correct email and verify that one. This does leave the first, unconfirmed account behind — cleanup of those is tracked separately in admin-account-cleanup.md, not as part of this step.
- Already-signed-in visitors to /signup are redirected straight to /panel (server-side session check)

## Step: email-verification-gate
Status: done
Criteria:
- Full-screen blocking gate component exists (components/panel/email-verification-gate.tsx)
- Gate checked against user.emailVerified in panel layout
- Google sign-ups bypass the gate (arrive pre-verified)

## Step: role-assignment
Status: done
Criteria:
- user_roles table exists with clinic/patient roles
- Clinic role assignment happens idempotently on every panel visit (app/panel/layout.tsx)
- Patient-only accounts are redirected to /patient instead of being auto-granted clinic
- RoleUpgradeGate exists for role-conflict resolution
- SUPERSEDED IN PART (2026-09-14): the self-service confirm-gate design
  described above (RoleUpgradeGate/PatientRoleGate letting a user opt
  into adding a second role themselves) is being replaced — see
  no-self-service-dual-role-accounts below for the new design. This step
  stays marked done because everything it originally shipped did work as
  described; it's the design itself that changed, not a bug in what was
  built.

## Step: no-self-service-dual-role-accounts
Status: not_started
Criteria:
- DECISION (Arun, 2026-09-14): the same email must never carry both
  clinic and patient roles via self-service. Today, landing on the
  "wrong" portal offers a Yes/No confirm ("add this role too?") — that
  self-service path is being REMOVED entirely. Going forward: landing on
  the wrong portal with an existing single-role account shows an
  informational message stating which account type they already have,
  auto-redirects (or offers a single button) to THEIR portal, and says
  to contact support if they genuinely want both. No Yes option, no
  role-adding UI at all on any of the four surfaces below — just
  redirect + message. Only Arun, via a support ticket, manually grants a
  second role from the admin side. This is a deliberate simplification —
  dual-role accounts become a rare, human-approved exception rather than
  a one-click self-service option.
- FOUR surfaces currently implement the old self-service confirm pattern
  and all four need the same rework (verified against actual code
  2026-09-14, not assumed from memory):
  1. app/panel/layout.tsx + components/panel/role-upgrade-gate.tsx
     (RoleUpgradeGate) — patient-only account lands on /panel.
     checkClinicRoleConflict (lib/actions/role-upgrade.ts) currently
     gates showing this; confirmClinicRoleAdd is the self-service grant
     to remove.
  2. app/patient/(protected)/layout.tsx + components/auth/patient-role-gate.tsx
     (PatientRoleGate) — non-patient-role account (e.g. clinic) lands in
     the patient portal's protected area. Currently calls provisionPatient
     directly on "Yes" with no separate conflict-check function (the
     layout's own `roles.length > 0` check is what triggers showing the
     gate) — that Yes path is what needs removing.
  3. components/auth/patient-login-form.tsx's roleConfirm view — same
     pattern, but at the moment of signing in/up directly at /patient/login
     rather than landing on an already-authenticated protected page.
     Uses checkPatientRoleConflict + provisionPatient, same functions as
     surface 4 below.
  4. components/booking/booking-wizard.tsx's ConfirmAuthModal (its own
     internal roleConfirm AuthView state) — the guest booking wizard's
     inline sign-in/sign-up step hits the exact same conflict check
     mid-booking. Needs the same treatment — and specifically needs to
     still let the booking itself complete as a GUEST booking (not block
     the appointment) when the person is blocked from adding the patient
     role, since the booking doesn't strictly require the patient role to
     succeed.
- checkPatientRoleConflict / checkClinicRoleConflict (the two functions
  computing `needsConfirm`) likely still have a role to play even in the
  new design — repurposed from "should I show a Yes/No prompt" to "should
  I show the new redirect-with-message screen instead of silently
  provisioning" — the underlying role-conflict DETECTION doesn't change,
  only what the UI does once a conflict is detected. provisionPatient and
  confirmClinicRoleAdd (the actual role-granting functions) become
  either unreachable from these four self-service surfaces or removed
  outright — TBD at implementation time whether to delete them or keep
  them as the function an eventual admin-side tool calls.
- DEPENDENCY, not yet resolved: admin-portal-tools.md's admin-users step
  covers the admin allowlist (who can access /admin), not granting a
  second role to a regular clinic/patient user. Fulfilling "contact
  support" tickets needs SOME way for Arun to actually grant the second
  role — doesn't need to be a polished admin UI tool for v1 (a manual
  Supabase row insert into user_roles would work fine), but worth Arun
  confirming whether that's sufficient or whether a proper admin tool is
  wanted. Not scoping that decision here — flagging so it isn't assumed
  solved by this step alone.

## Step: negocio-setup
Status: done
Criteria:
- Business form exists at /app/panel/business/page.tsx
- Captures name, business type, legal ID, slug
- Business type options ordered: Fisioterapia, Fitness y entreno, Nutrición, Psicología, Coaching, Estética y belleza, Clases y tutorías, Otro (lib/onboarding/data.ts's BUSINESS_TYPES array)
- Slug is permanent after creation (read-only on edit)
- Slug moderation: clean slugs active instantly, flagged ones pending_review
- Address captured as split fields (street, postal code, city, province) with postal-code autofill (lib/business/postal-codes.ts, silent-miss — convenience, not required)
- Phone captured as country code (+34 default, lib/business/phone-country-codes.ts) + number, separate fields
- Contact email field editable and separate from login email
- Logo upload (added 2026-08-24, previously undocumented despite shipping — commits c2da193, f4fda35, 8998c21, ee2ad0c, dbbbf31): LogoUploader (business-form.tsx) uploads to a `business-logos` Supabase Storage bucket via uploadBusinessLogo (lib/actions/business.ts), 2MB limit matching the bucket's own file_size_limit. Stored as `logo_url` on kalendar_businesses (nullable). Old logo file is best-effort deleted from storage on replace or removal — not fatal if that cleanup fails, the URL swap/clear is what matters. Rendered on both the panel business form and the public booking page (app/bookings/[slug]/page.tsx), sized to fit rather than cropped into a fixed square — deliberate, since many real clinic logos are wide wordmarks, not icons. No logo uploaded: falls back to business name + address text only (no placeholder square). Placement: logo uploader sits below the slug field, with a "Vista previa" link next to it that opens the live public booking page in a new tab — disabled/greyed while the slug is still pending_review (can't preview a page that isn't reachable yet).

## Step: servicios-setup
Status: done
Criteria:
- Services manager exists at /app/panel/services/page.tsx
- Can create custom services (name, duration, price)
- Template flow: multi-select templates -> staged editable drafts -> bulk confirm
- kalendar_services table stores catalog

## Step: equipo-setup
Status: done
Criteria:
- Team manager exists at /app/panel/team/page.tsx
- team_mode (solo|team) stored on kalendar_businesses
- Owner auto-seeded as team member (ensureOwnerSeeded)
- kalendar_team_members table exists

## Step: disponibilidad-setup
Status: done
Criteria:
- Availability manager exists at /app/panel/availability/page.tsx
- First-time setup wizard (3 steps: days -> standard hours -> review) when hasSavedHours is false
- Whole-week atomic save (no partial week persistence)
- kalendar_business_hours table exists

## Step: booking-page-live
Status: done
Criteria:
- Public booking page resolves at /bookings/[slug]
- Booking link surfaced in panel (booking-page-card.tsx on panel home, business-form.tsx on Negocio)
- setup-complete-banner.tsx reflects onboarding completion state

## Step: panel-home-gating
Status: done
Criteria:
- Stats widgets (Hoy / Esta semana) are hidden until onboarding checklist is 100% complete
- Accesos rápidos panel is hidden until onboarding checklist is 100% complete
- Only the onboarding checklist card is visible pre-completion
- Widgets appear automatically once all 4 checklist items are done (no page reload required)

## Notes / Deviations
- Subscription/trial gating (what happens once a clinic's Negocio/Servicios/Equipo/Disponibilidad setup is done but they haven't subscribed, or their subscription lapses) is tracked in subscription-billing.md under feature-gating and trial-period-mechanism, not here — it's a continuous billing-state concern rather than a one-time onboarding step, so it made more sense consolidated there than duplicated across both files.
