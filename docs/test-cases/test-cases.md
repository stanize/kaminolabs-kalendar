Guest books an appointment — full wizard happy path | Pick service, provider (if team), date/time, enter guest name/email/phone, submit | /bookings/{slug} | Use a real inbox you can check | high
Solo business — no provider-selection step | Confirm the wizard skips provider choice entirely for a solo (non-team) business | /bookings/{solo-slug} | | medium
Team business — "Cualquiera" resolves to a concrete provider | Pick "Cualquiera" (any provider), confirm the created booking has a real team_member_id | /bookings/{team-slug} | | medium
Double-booking is prevented | Open the same slot in two tabs, submit both, second must fail with "ese horario ya no está disponible" | /bookings/{slug} | | high
Guest booking is confirmed immediately | Confirm status is "confirmed" right away, no pending/24h review window | /bookings/{slug} | | high
Guest receives confirmation email with .ics attachment | | /bookings/{slug} | real email | medium
Clinic owner receives "Nueva cita" notification email | | /panel/calendar | | medium
Cancel via the emailed cancel link | | /bookings/cancel/{token} | | high
Auth gate — create an account mid-booking instead of guest | | /bookings/{slug} | | medium
Auth gate — sign in as an existing patient mid-booking | | /bookings/{slug} | existing patient login | medium
Auth gate — decline account creation, booking still completes as guest | | /bookings/{slug} | | medium
Rate limiting — 6th guest booking from same IP in one day is rejected | | /bookings/{slug} | | low
Rate limiting — 11th authenticated booking from same IP in one day is rejected | | /bookings/{slug} | | low
Honeypot field silently rejects a bot submission | Fill the hidden honeypot input via devtools; expect a fake success, no real row created | /bookings/{slug} | | low
Clinic sign-up with email/password | | /signup | new email address | high
Clinic sign-up with Google OAuth | | /signup | | high
Email verification gate blocks the panel until verified | | /panel | unverified email/password account | high
Google sign-up bypasses the verification gate | | /panel | | medium
Role conflict — patient-only session visiting /panel is redirected, no self-service role add | | /panel | existing patient-only account | high
Role conflict — clinic-only session visiting /patient is redirected | | /patient | existing clinic-only account | high
Role conflict — /signin is role-aware for an already-patient session | | /signin | | medium
Role conflict — /patient/login is role-aware for an already-clinic session | | /patient/login | | medium
Role conflict messages name the actual account email | | | | low
Role conflict mid-booking-wizard — "continue as guest" still completes the booking | | /bookings/{slug} | | medium
Negocio setup — create a business and get a slug assigned | | /panel/business | | high
Negocio setup — slug is read-only/immutable after creation | | /panel/business | | medium
Negocio setup — upload, replace, and remove a logo | | /panel/business | PNG/JPG under 2MB | low
Servicios setup — create a custom service | | /panel/services | | high
Servicios setup — template multi-select → staged drafts → bulk confirm | | /panel/services | | medium
Equipo setup — add a team member, business switches to team mode | | /panel/team | | medium
Disponibilidad setup — first-time wizard (days → hours → review) | | /panel/availability | | high
Booking page goes live at the assigned slug once setup is complete | | /bookings/{slug} | | high
Panel home — stats widgets hidden until onboarding checklist is 100% | | /panel | | medium
Panel home — widgets appear automatically once complete, no reload needed | | /panel | | low
Calendar — switch between day/week/month views | | /panel/calendar | | medium
Calendar week view — one column per provider for a team business | | /panel/calendar | | medium
Clientes tab — guest_confirmed row shows "mark reviewed" action | | /panel/calendar | | medium
Clientes tab — first-time/returning rows are informational only, no action | | /panel/calendar | | low
Manual appointment creation — click an open slot | | /panel/calendar | | high
Manual appointment creation — double-booking is prevented | | /panel/calendar | | high
Manual appointment creation — confirmation email only sent if an email was entered and checkbox checked | | /panel/calendar | | medium
Appointment editing — change time/service/provider on an upcoming booking | | /panel/calendar | | high
Owner cancellation — frees the slot and emails the client | | /panel/calendar | | high
Cancellation request review — approve (inside the cancellation window) | | /panel/calendar | | medium
Cancellation request review — deny | | /panel/calendar | | medium
Cancellation requests widget — count + deep link shown on panel home | | /panel | | low
Reminder failure — amber marker on chip + detail in booking modal | | /panel/calendar | | low
Past appointments remain visible and clickable in the grid | | /panel/calendar | | medium
Mark result — completed / no_show / cancelled | | /panel/calendar | | high
Mark payment — cash | | /panel/calendar | | high
Mark payment — card | | /panel/calendar | | medium
Mark payment — bono, oldest pre-selected, can override to a different bono | | /panel/calendar | client with 2+ active bonos | high
Mark payment — switching an already-bono-paid booking to cash/card is blocked in this modal | | /panel/calendar | | medium
Past appointment editing — service/time/provider editable on a past booking | | /panel/calendar | | medium
Client 360 — linked appointment history shows on client detail | | /panel/clients/{id} | | medium
Clients list — directory with search | | /panel/clients | | medium
Client detail — upcoming + history sections, denormalized counters correct | | /panel/clients/{id} | | medium
Client detail — edit contact info | | /panel/clients/{id} | | low
Private clinic notes — add, edit, delete | | /panel/clients/{id} | | medium
Private clinic notes — never visible anywhere in the patient portal | Confirm a note never leaks to /patient for the same linked person | /patient | | high
Client linking — guest booking always creates a new client row | | /bookings/{slug} | | low
Client linking — manual booking via client picker links an existing row | | /panel/calendar | | medium
Auto-note from booking notes — guest booking with a comment creates a client note | | /bookings/{slug} | | medium
Auto-note from booking notes — manual booking with a note creates a client note | | /panel/calendar | | medium
Auto-note from booking notes — editing a booking's notes does NOT create a duplicate note | | /panel/calendar | | low
Cancellation window setting — change the preset/custom value | | /panel/settings/bookings | | medium
Cancellation window — self-cancel outside the window is immediate, inside becomes a request | | /patient/bookings | | high
Bono types — create, edit, deactivate | | /panel/bonos | | medium
Bono purchase recording — sell a bono to a client | | /panel/bonos | | high
Session deduction — paying with a bono deducts one session | | /panel/calendar | client with an active bono | high
Session deduction — client with no active bono shows no bono option at all | | /panel/calendar | | medium
Bono session reversal — switch a used session back to cash/card from the Bonos page | | /panel/bonos | | medium
Client page bono summary — active and exhausted bonos both shown | | /panel/clients/{id} | | medium
Patient bono view — "Mis bonos" on patient dashboard is view-only | | /patient | patient with a bono at some clinic | medium
Bono usage report — filter by client name, sort by remaining sessions | | /panel/bonos | | low
Patient sign-up | | /patient/login | new email address | high
Patient sign-in | | /patient/login | existing patient login | high
Patient forgot password / reset flow | | /forgot-password | | medium
Patient email verification gate | | /patient | unverified patient account | medium
Patient dashboard home — upcoming and recent bookings | | /patient | | medium
Full booking history page | | /patient/bookings | | medium
Self-service cancel — outside the cancellation window cancels immediately | | /patient/bookings | | high
Self-service cancel — inside the window becomes a request, clinic notified | | /patient/bookings | | high
Patient profile — edit own profile | | /patient/profile | | low
WhatsApp settings — enable and save Twilio credentials | | /panel/business | Twilio sandbox credentials | medium
WhatsApp settings — auth token stays write-only, blank save keeps the existing value | | /panel/business | | low
WhatsApp conversation — full booking flow via Sandbox | Join sandbox, message the number, pick service/date/time, confirm | WhatsApp | joined sandbox number | high
WhatsApp conversation — slot taken mid-conversation re-prompts with fresh options | | WhatsApp | | medium
WhatsApp — sender's profile name captured as the client name | | WhatsApp | | low
Manual booking WhatsApp checkbox auto-checks when a phone is entered | | /panel/calendar | | low
Manual booking WhatsApp confirmation actually sends to a sandbox-joined number | | /panel/calendar | sandbox-joined number | medium
Recurring festivos — add and remove | | /panel/availability/holidays | | medium
Provider time-off — add and remove, scoped to one provider | | /panel/availability/time-off | | medium
Manual booking closure warning — amber note shown when picking a festivo date | | /panel/calendar | | medium
Availability engine — public wizard excludes slots on a fully-closed day | | /bookings/{slug} | | high
Availability engine — a partial-day closure correctly narrows available slots | | /bookings/{slug} | | medium
Manual modal keeps full override — clinic can still book on a closed day | | /panel/calendar | | low
Existing-bookings conflict alert — a new closure flags a colliding booking | | /panel/availability | | low
Conflicts tab — lists appointments affected by closures | | /panel/calendar | | low
Subscribe — pay via Stripe Elements in-app | | /panel/settings | Stripe test card 4242 4242 4242 4242 | high
Subscribe — falls back to Checkout on Stripe.js load timeout | | /panel/settings | | low
Webhook sync — subscription_status updates after a successful payment | | /panel/settings | | high
Payment method update | | /panel/settings | Stripe test card | medium
Cancel subscription — soft cancel at period end | | /panel/settings | | medium
Resume a pending cancellation before period end | | /panel/settings | | medium
Privacy policy page loads | | /legal/privacy | | low
Terms of service page loads | | /legal/terms | | low
Legal links present on sign-up, patient login, booking wizard, and landing footer | | / | | low
Client error logging — a thrown client error reaches the logs | | | | low
Structured event log — a real server-side event lands in kalendar_error_log | | | | low
Admin error-log dashboard — filters (tag/severity/business/date/resolved) work | | /admin/error-log | | medium
Admin error-log dashboard — bulk delete matching current filter | | /admin/error-log | | low
Admin error-log dashboard — bulk mark resolved | | /admin/error-log | | low
Demo account creation via the internal provisioning endpoint | | | | low
Presales code — generate, copy, revoke | | /admin/demo-accounts | | low
Admin customer overview — list, add/remove role, delete a user | | /admin/customers | | medium
Admin slug reviews — approve a flagged slug | | /admin/slugs | | medium
Admin slug reviews — reject a flagged slug | | /admin/slugs | | medium
Admin orphaned bookings — list renders | | /admin/orphaned-bookings | | low
Admin users — add and remove an allowlist entry | | /admin/users | | medium
Admin appointment generator dev tool | | /admin/appointment-gen | | low
Admin date cycler dev tool | | /admin/date-cycler | | low
Admin schema reset — readiness check, type-to-confirm gate, reset runs | | /admin/schema-reset | | low
Customer dashboard — business detail page loads every section | | /admin/customers/business/{id} | | medium
Customer dashboard — changing a slug writes history and emails the owner | | /admin/customers/business/{id} | | high
Customer dashboard — slug_active off shows the "temporarily down" public page | | /bookings/{slug} | | high
Customer dashboard — a retired slug shows the "no longer active" public page | | /bookings/{old-slug} | | medium
Customer dashboard — relink a retired slug to a business | | /admin/customers/business/{id} | | low
Customer dashboard — delete-forever frees a retired slug for reuse | | /admin/customers/business/{id} | | low
Testing tracker — create a test case | | /admin/testing/cases | | low
Testing tracker — bulk import a batch of cases | | /admin/testing/cases | | low
Testing tracker — create a testing project with a priority filter | | /admin/testing/projects | | low
Testing tracker — mark checklist items successful/unsuccessful | | /admin/testing/projects/{id} | | low
Appointment reminders — 24h-before reminder sends for a confirmed booking | | | booking ~24h out | medium
Appointment reminders — 1h-before reminder sends | | | booking ~1h out | medium
Appointment reminders — no duplicate sends across cron runs | | | | low
Appointment reminders — send failure surfaces on the calendar chip | | /panel/calendar | | low
