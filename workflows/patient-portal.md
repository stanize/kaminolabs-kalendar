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
Status: not_started
Criteria:
- Patient can cancel an upcoming booking directly from the portal (dashboard or full history), not only via the emailed cancel-token link
- Cancelling from the portal notifies the clinic the same way an owner- or token-based cancellation does
- Cancelled booking immediately reflects the cancelled status badge without a page reload

## Step: profile-management
Status: not_started
Criteria:
- Patient can view/edit their own profile (name, phone, contact email) from the portal
- No such editing action exists yet in lib/actions/patient.ts today (only checkPatientRoleConflict, provisionPatient, getPatientProfile)

## Notes / Deviations
- The portal is already meaningfully more built than "very simple" — auth, provisioning with role-conflict handling, a dashboard, and a full history page all exist and work. The two gaps (self-service-cancel, profile-management) are the main things standing between what exists today and a complete simple portal.
- getPatientProfile / provisionPatient / checkPatientRoleConflict live in lib/actions/patient.ts — worth checking this file specifically before building profile-management, since a phone param is already accepted by provisionPatient but there's no follow-up edit path after that initial capture.
