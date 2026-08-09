# Workflow: Patient Portal

A simple portal where a patient/client can log in and see their booking history across clinics — separate from the clinic-facing panel.

## Step: patient-auth
Status: done
Criteria:
- Login page exists at /app/patient/login/page.tsx
- Google OAuth and email/password login both available (PatientAuthCard / patient-login-form.tsx)
- Already-authenticated visitors to /patient/login are redirected straight to redirectTo (or /patient)
- redirectTo query param is validated as a same-site relative path only (open-redirect guard)
- When arriving from a specific clinic's booking page, a "back to booking" link is shown instead of forcing login

## Step: patient-provisioning
Status: done
Criteria:
- A user with zero roles landing in the protected patient area is silently provisioned: patient role assigned + kalendar_patients row upserted (handles Google OAuth arriving directly at /patient, bypassing the form's explicit provision call)
- A user who already holds a different role (e.g. clinic owner) is NOT silently granted patient — PatientRoleGate asks for explicit confirmation first
- Provisioning is idempotent (upsert on user_id)

## Step: dashboard-home
Status: done
Criteria:
- Protected dashboard at /app/patient/(protected)/page.tsx shows upcoming bookings (status != cancelled, starts_at >= now)
- Shows a short "recent" list of past/cancelled bookings (last 3), with a link to the full list if more exist
- Each booking shows service name, business name, formatted date/time, and a status badge
- Empty state shown when there are no upcoming bookings
- Each upcoming booking links out to that business's public booking page

## Step: full-booking-history
Status: done
Criteria:
- Dedicated page at /app/patient/(protected)/bookings/page.tsx lists all bookings, not just the dashboard's abbreviated view
- Same status badge / formatting conventions as the dashboard

## Step: self-service-cancel
Status: done
Criteria:
- Patient can cancel an upcoming booking directly from the portal (dashboard's upcoming list and full bookings list), not only via the emailed cancel-token link
- cancelBookingAsPatient is scoped to the caller's own patient_id — cannot touch another patient's or a guest booking
- Only pending_confirmation or confirmed bookings can be cancelled (errCannotCancel otherwise, mirrors owner-cancellation's rule)
- Cancelling from the portal notifies the clinic via the same shared notifyCancellation helper used by owner- and token-based cancellation
- UI has an inline confirm/keep step before cancelling (PatientCancelButton), not an immediate destructive click
- Cancelled booking's status flips immediately via onCancelled callback (optimistic local update) rather than waiting on a full page reload; router.refresh() syncs server state in the background

## Step: profile-management
Status: done
Criteria:
- Patient can view/edit their own profile from a dedicated /patient/profile page (PatientProfileForm)
- Editable fields: name, phone
- updatePatientProfile is scoped to the caller's own kalendar_patients row via user_id
- Contact email is deliberately NOT editable here — confirmed intentional (getPatientProfile / updatePatientProfile comments), separate from the login account's Better Auth email
- Name requires at least 1 character (errNameRequired); phone is optional and stored as null if blank

## Notes / Deviations
- User-visible copy across public-booking, patient-portal, and panel-shell was changed from "Paciente"/"patient" to "Cliente"/"client" — code identifiers, routes, roles, and table names (kalendar_patients, patient_id, etc.) were deliberately left unchanged, only display text. Not a defined step anywhere; flagging here since it touches this workflow's UI.
- A shared PatientHeader component (components/patient/patient-header.tsx) now provides consistent nav (Inicio / Perfil / Todas las reservas / Cerrar sesión) across all three protected pages — this wasn't a criterion in any step but is worth capturing since it's a meaningful piece of the portal's shape. Deliberately excludes a generic "book an appointment" link since there's no clinic directory to send a patient to (booking-again is per-booking, scoped to that booking's clinic, via a "Pedir nueva cita" button).
- The portal is already meaningfully more built than "very simple" — worth revisiting with Arun whether further scope (e.g. a clinic directory / search) is wanted or whether this is considered feature-complete for now.
