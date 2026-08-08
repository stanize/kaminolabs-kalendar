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

## Step: negocio-setup
Status: in_progress
Criteria:
- Business form exists at /app/panel/business/page.tsx
- Captures name, business type, legal ID, slug
- Business type options ordered: Fisioterapia, Fitness y entreno, Nutrición, Psicología, Coaching, Estética y belleza, Clases y tutorías, Otro
- Slug is permanent after creation (read-only on edit)
- Slug moderation: clean slugs active instantly, flagged ones pending_review
- Address captured as split fields (street, postal code, city, province) with postal-code autofill
- Phone captured as country code (+34 default) + number, separate columns
- Contact email field editable and separate from login email

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
Status: not_started
Criteria:
- Stats widgets (Hoy / Esta semana) are hidden until onboarding checklist is 100% complete
- Accesos rápidos panel is hidden until onboarding checklist is 100% complete
- Only the onboarding checklist card is visible pre-completion
- Widgets appear automatically once all 4 checklist items are done (no page reload required)

## Step: subscription-activation
Status: not_started
Criteria:
- Panel features are gated on kalendar_businesses.subscription_status
- Unsubscribed/incomplete businesses are blocked from key panel actions
- Clear upgrade prompt shown when gated

## Notes / Deviations
(freeform — anything found in code that doesn't map to a defined step)
