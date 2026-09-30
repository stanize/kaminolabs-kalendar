 | Guest books an appointment — full wizard happy path | Pick service, provider (if team), date/time, enter guest name/email/phone, submit | /bookings/{slug} | Use a real inbox you can check | high | Public Booking | Guest Wizard |  | 
 | Solo business — no provider-selection step | Confirm the wizard skips provider choice entirely for a solo (non-team) business | /bookings/{solo-slug} |  | medium | Public Booking | Guest Wizard |  | 
 | Team business — "Cualquiera" resolves to a concrete provider | Pick "Cualquiera" (any provider), confirm the created booking has a real team_member_id | /bookings/{team-slug} |  | medium | Public Booking | Guest Wizard |  | 
 | Double-booking is prevented | Open the same slot in two tabs, submit both, second must fail with "ese horario ya no está disponible" | /bookings/{slug} |  | high | Public Booking | Guest Wizard |  | 
 | Guest booking is confirmed immediately | Confirm status is "confirmed" right away, no pending/24h review window | /bookings/{slug} |  | high | Public Booking | Guest Wizard |  | 
 | Guest receives confirmation email with .ics attachment |  | /bookings/{slug} | real email | medium | Public Booking | Guest Wizard |  | 
 | Clinic owner receives "Nueva cita" notification email |  | /panel/calendar |  | medium | Public Booking | Guest Wizard |  | 
 | Cancel via the emailed cancel link |  | /bookings/cancel/{token} |  | high | Public Booking | Guest Wizard |  | 
 | Auth gate — create an account mid-booking instead of guest |  | /bookings/{slug} |  | medium | Public Booking | Guest Wizard |  | 
 | Auth gate — sign in as an existing patient mid-booking |  | /bookings/{slug} | existing patient login | medium | Public Booking | Guest Wizard |  | 
 | Auth gate — decline account creation, booking still completes as guest |  | /bookings/{slug} |  | medium | Public Booking | Guest Wizard |  | 
 | Rate limiting — 6th guest booking from same IP in one day is rejected |  | /bookings/{slug} |  | low | Public Booking | Rate Limiting & Abuse |  | 
 | Rate limiting — 11th authenticated booking from same IP in one day is rejected |  | /bookings/{slug} |  | low | Public Booking | Rate Limiting & Abuse |  | 
 | Honeypot field silently rejects a bot submission | Fill the hidden honeypot input via devtools; expect a fake success, no real row created | /bookings/{slug} |  | low | Public Booking | Rate Limiting & Abuse |  | 
 | Clinic sign-up with email/password |  | /signup | new email address | high | Onboarding | Sign-up & Roles |  | 
 | Clinic sign-up with Google OAuth |  | /signup |  | high | Onboarding | Sign-up & Roles |  | 
 | Email verification gate blocks the panel until verified |  | /panel | unverified email/password account | high | Onboarding | Sign-up & Roles |  | 
 | Google sign-up bypasses the verification gate |  | /panel |  | medium | Onboarding | Sign-up & Roles |  | 
 | Role conflict — patient-only session visiting /panel is redirected, no self-service role add |  | /panel | existing patient-only account | high | Onboarding | Sign-up & Roles |  | 
 | Role conflict — clinic-only session visiting /patient is redirected |  | /patient | existing clinic-only account | high | Onboarding | Sign-up & Roles |  | 
 | Role conflict — /signin is role-aware for an already-patient session |  | /signin |  | medium | Onboarding | Sign-up & Roles |  | 
 | Role conflict — /patient/login is role-aware for an already-clinic session |  | /patient/login |  | medium | Onboarding | Sign-up & Roles |  | 
 | Role conflict messages name the actual account email |  |  |  | low | Onboarding | Sign-up & Roles |  | 
 | Role conflict mid-booking-wizard — "continue as guest" still completes the booking |  | /bookings/{slug} |  | medium | Onboarding | Sign-up & Roles |  | 
 | Negocio setup — create a business and get a slug assigned |  | /panel/business |  | high | Onboarding | Setup Wizard |  | 
 | Negocio setup — slug is read-only/immutable after creation |  | /panel/business |  | medium | Onboarding | Setup Wizard |  | 
 | Negocio setup — upload, replace, and remove a logo |  | /panel/business | PNG/JPG under 2MB | low | Onboarding | Setup Wizard |  | 
 | Servicios setup — create a custom service |  | /panel/services |  | high | Onboarding | Setup Wizard |  | 
 | Servicios setup — template multi-select → staged drafts → bulk confirm |  | /panel/services |  | medium | Onboarding | Setup Wizard |  | 
 | Equipo setup — add a team member, business switches to team mode |  | /panel/team |  | medium | Onboarding | Setup Wizard |  | 
 | Disponibilidad setup — first-time wizard (days → hours → review) |  | /panel/availability |  | high | Onboarding | Setup Wizard |  | 
 | Booking page goes live at the assigned slug once setup is complete |  | /bookings/{slug} |  | high | Onboarding | Setup Wizard |  | 
 | Panel home — stats widgets hidden until onboarding checklist is 100% |  | /panel |  | medium | Onboarding | Setup Wizard |  | 
 | Panel home — widgets appear automatically once complete, no reload needed |  | /panel |  | low | Onboarding | Setup Wizard |  | 
 | Calendar — switch between day/week/month views |  | /panel/calendar |  | medium | Panel Calendar | Upcoming |  | 
 | Calendar week view — one column per provider for a team business |  | /panel/calendar |  | medium | Panel Calendar | Upcoming |  | 
 | Clientes tab — guest_confirmed row shows "mark reviewed" action |  | /panel/calendar |  | medium | Panel Calendar | Upcoming |  | 
 | Clientes tab — first-time/returning rows are informational only, no action |  | /panel/calendar |  | low | Panel Calendar | Upcoming |  | 
 | Manual appointment creation — click an open slot |  | /panel/calendar |  | high | Panel Calendar | Upcoming |  | 
 | Manual appointment creation — double-booking is prevented |  | /panel/calendar |  | high | Panel Calendar | Upcoming |  | 
 | Manual appointment creation — confirmation email only sent if an email was entered and checkbox checked |  | /panel/calendar |  | medium | Panel Calendar | Upcoming |  | 
 | Appointment editing — change time/service/provider on an upcoming booking |  | /panel/calendar |  | high | Panel Calendar | Upcoming |  | 
 | Owner cancellation — frees the slot and emails the client |  | /panel/calendar |  | high | Panel Calendar | Upcoming |  | 
 | Cancellation request review — approve (inside the cancellation window) |  | /panel/calendar |  | medium | Panel Calendar | Upcoming |  | 
 | Cancellation request review — deny |  | /panel/calendar |  | medium | Panel Calendar | Upcoming |  | 
 | Cancellation requests widget — count + deep link shown on panel home |  | /panel |  | low | Panel Calendar | Upcoming |  | 
 | Reminder failure — amber marker on chip + detail in booking modal |  | /panel/calendar |  | low | Panel Calendar | Upcoming |  | 
 | Past appointments remain visible and clickable in the grid |  | /panel/calendar |  | medium | Panel Calendar | Past |  | 
 | Mark result — completed / no_show / cancelled |  | /panel/calendar |  | high | Panel Calendar | Past |  | 
 | Mark payment — cash |  | /panel/calendar |  | high | Panel Calendar | Past |  | 
 | Mark payment — card |  | /panel/calendar |  | medium | Panel Calendar | Past |  | 
 | Mark payment — bono, oldest pre-selected, can override to a different bono |  | /panel/calendar | client with 2+ active bonos | high | Panel Calendar | Past |  | 
 | Mark payment — switching an already-bono-paid booking to cash/card is blocked in this modal |  | /panel/calendar |  | medium | Panel Calendar | Past |  | 
 | Past appointment editing — service/time/provider editable on a past booking |  | /panel/calendar |  | medium | Panel Calendar | Past |  | 
 | Client 360 — linked appointment history shows on client detail |  | /panel/clients/{id} |  | medium | Clients | Client 360 |  | 
 | Clients list — directory with search |  | /panel/clients |  | medium | Clients | Client 360 |  | 
 | Client detail — upcoming + history sections, denormalized counters correct |  | /panel/clients/{id} |  | medium | Clients | Client 360 |  | 
 | Client detail — edit contact info |  | /panel/clients/{id} |  | low | Clients | Client 360 |  | 
 | Private clinic notes — add, edit, delete |  | /panel/clients/{id} |  | medium | Clients | Client 360 |  | 
 | Private clinic notes — never visible anywhere in the patient portal | Confirm a note never leaks to /patient for the same linked person | /patient |  | high | Clients | Client 360 |  | 
 | Client linking — guest booking always creates a new client row |  | /bookings/{slug} |  | low | Clients | Client Linking & Notes |  | 
 | Client linking — manual booking via client picker links an existing row |  | /panel/calendar |  | medium | Clients | Client Linking & Notes |  | 
 | Auto-note from booking notes — guest booking with a comment creates a client note |  | /bookings/{slug} |  | medium | Clients | Client Linking & Notes |  | 
 | Auto-note from booking notes — manual booking with a note creates a client note |  | /panel/calendar |  | medium | Clients | Client Linking & Notes |  | 
 | Auto-note from booking notes — editing a booking's notes does NOT create a duplicate note |  | /panel/calendar |  | low | Clients | Client Linking & Notes |  | 
 | Cancellation window setting — change the preset/custom value |  | /panel/settings/bookings |  | medium | Clinic Configuration |  |  | 
 | Cancellation window — self-cancel outside the window is immediate, inside becomes a request |  | /patient/bookings |  | high | Clinic Configuration |  |  | 
 | Bono types — create, edit, deactivate |  | /panel/bonos |  | medium | Bonos |  |  | 
 | Bono purchase recording — sell a bono to a client |  | /panel/bonos |  | high | Bonos |  |  | 
 | Session deduction — paying with a bono deducts one session |  | /panel/calendar | client with an active bono | high | Bonos |  |  | 
 | Session deduction — client with no active bono shows no bono option at all |  | /panel/calendar |  | medium | Bonos |  |  | 
 | Bono session reversal — switch a used session back to cash/card from the Bonos page |  | /panel/bonos |  | medium | Bonos |  |  | 
 | Client page bono summary — active and exhausted bonos both shown |  | /panel/clients/{id} |  | medium | Bonos |  |  | 
 | Patient bono view — "Mis bonos" on patient dashboard is view-only |  | /patient | patient with a bono at some clinic | medium | Bonos |  |  | 
 | Bono usage report — filter by client name, sort by remaining sessions |  | /panel/bonos |  | low | Bonos |  |  | 
 | Patient sign-up |  | /patient/login | new email address | high | Patient Portal |  |  | 
 | Patient sign-in |  | /patient/login | existing patient login | high | Patient Portal |  |  | 
 | Patient forgot password / reset flow |  | /forgot-password |  | medium | Patient Portal |  |  | 
 | Patient email verification gate |  | /patient | unverified patient account | medium | Patient Portal |  |  | 
 | Patient dashboard home — upcoming and recent bookings |  | /patient |  | medium | Patient Portal |  |  | 
 | Full booking history page |  | /patient/bookings |  | medium | Patient Portal |  |  | 
 | Self-service cancel — outside the cancellation window cancels immediately |  | /patient/bookings |  | high | Patient Portal |  |  | 
 | Self-service cancel — inside the window becomes a request, clinic notified |  | /patient/bookings |  | high | Patient Portal |  |  | 
 | Patient profile — edit own profile |  | /patient/profile |  | low | Patient Portal |  |  | 
 | WhatsApp settings — enable and save Twilio credentials |  | /panel/business | Twilio sandbox credentials | medium | WhatsApp |  |  | 
 | WhatsApp settings — auth token stays write-only, blank save keeps the existing value |  | /panel/business |  | low | WhatsApp |  |  | 
 | WhatsApp conversation — full booking flow via Sandbox | Join sandbox, message the number, pick service/date/time, confirm | WhatsApp | joined sandbox number | high | WhatsApp |  |  | 
 | WhatsApp conversation — slot taken mid-conversation re-prompts with fresh options |  | WhatsApp |  | medium | WhatsApp |  |  | 
 | WhatsApp — sender's profile name captured as the client name |  | WhatsApp |  | low | WhatsApp |  |  | 
 | Manual booking WhatsApp checkbox auto-checks when a phone is entered |  | /panel/calendar |  | low | WhatsApp |  |  | 
 | Manual booking WhatsApp confirmation actually sends to a sandbox-joined number |  | /panel/calendar | sandbox-joined number | medium | WhatsApp |  |  | 
 | Recurring festivos — add and remove |  | /panel/availability/holidays |  | medium | Availability & Holidays |  |  | 
 | Provider time-off — add and remove, scoped to one provider |  | /panel/availability/time-off |  | medium | Availability & Holidays |  |  | 
 | Manual booking closure warning — amber note shown when picking a festivo date |  | /panel/calendar |  | medium | Availability & Holidays |  |  | 
 | Availability engine — public wizard excludes slots on a fully-closed day |  | /bookings/{slug} |  | high | Availability & Holidays |  |  | 
 | Availability engine — a partial-day closure correctly narrows available slots |  | /bookings/{slug} |  | medium | Availability & Holidays |  |  | 
 | Manual modal keeps full override — clinic can still book on a closed day |  | /panel/calendar |  | low | Availability & Holidays |  |  | 
 | Existing-bookings conflict alert — a new closure flags a colliding booking |  | /panel/availability |  | low | Availability & Holidays |  |  | 
 | Conflicts tab — lists appointments affected by closures |  | /panel/calendar |  | low | Availability & Holidays |  |  | 
 | Subscribe — pay via Stripe Elements in-app |  | /panel/settings | Stripe test card 4242 4242 4242 4242 | high | Billing |  |  | 
 | Subscribe — falls back to Checkout on Stripe.js load timeout |  | /panel/settings |  | low | Billing |  |  | 
 | Webhook sync — subscription_status updates after a successful payment |  | /panel/settings |  | high | Billing |  |  | 
 | Payment method update |  | /panel/settings | Stripe test card | medium | Billing |  |  | 
 | Cancel subscription — soft cancel at period end |  | /panel/settings |  | medium | Billing |  |  | 
 | Resume a pending cancellation before period end |  | /panel/settings |  | medium | Billing |  |  | 
 | Privacy policy page loads |  | /legal/privacy |  | low | Legal |  |  | 
 | Terms of service page loads |  | /legal/terms |  | low | Legal |  |  | 
 | Legal links present on sign-up, patient login, booking wizard, and landing footer |  | / |  | low | Legal |  |  | 
 | Client error logging — a thrown client error reaches the logs |  |  |  | low | Error Monitoring |  |  | 
 | Structured event log — a real server-side event lands in kalendar_error_log |  |  |  | low | Error Monitoring |  |  | 
 | Admin error-log dashboard — filters (tag/severity/business/date/resolved) work |  | /admin/error-log |  | medium | Error Monitoring |  |  | 
 | Admin error-log dashboard — bulk delete matching current filter |  | /admin/error-log |  | low | Error Monitoring |  |  | 
 | Admin error-log dashboard — bulk mark resolved |  | /admin/error-log |  | low | Error Monitoring |  |  | 
 | Demo account creation via the internal provisioning endpoint |  |  |  | low | Admin Portal | Presales Demos |  | 
 | Presales code — generate, copy, revoke |  | /admin/demo-accounts |  | low | Admin Portal | Presales Demos |  | 
 | Admin customer overview — list, add/remove role, delete a user |  | /admin/customers |  | medium | Admin Portal | Customers |  | 
 | Admin slug reviews — approve a flagged slug |  | /admin/slugs |  | medium | Admin Portal | Slugs |  | 
 | Admin slug reviews — reject a flagged slug |  | /admin/slugs |  | medium | Admin Portal | Slugs |  | 
 | Admin orphaned bookings — list renders |  | /admin/orphaned-bookings |  | low | Admin Portal | Orphaned Bookings |  | 
 | Admin users — add and remove an allowlist entry |  | /admin/users |  | medium | Admin Portal | Admin Users |  | 
 | Admin appointment generator dev tool |  | /admin/appointment-gen |  | low | Admin Portal | Dev Tools |  | 
 | Admin date cycler dev tool |  | /admin/date-cycler |  | low | Admin Portal | Dev Tools |  | 
 | Admin schema reset — readiness check, type-to-confirm gate, reset runs |  | /admin/schema-reset |  | low | Admin Portal | Dev Tools |  | 
 | Customer dashboard — business detail page loads every section |  | /admin/customers/business/{id} |  | medium | Admin Portal | Customer Dashboard |  | 
 | Customer dashboard — changing a slug writes history and emails the owner |  | /admin/customers/business/{id} |  | high | Admin Portal | Customer Dashboard |  | 
 | Customer dashboard — slug_active off shows the "temporarily down" public page |  | /bookings/{slug} |  | high | Admin Portal | Customer Dashboard |  | 
 | Customer dashboard — a retired slug shows the "no longer active" public page |  | /bookings/{old-slug} |  | medium | Admin Portal | Customer Dashboard |  | 
 | Customer dashboard — relink a retired slug to a business |  | /admin/customers/business/{id} |  | low | Admin Portal | Customer Dashboard |  | 
 | Customer dashboard — delete-forever frees a retired slug for reuse |  | /admin/customers/business/{id} |  | low | Admin Portal | Customer Dashboard |  | 
 | Testing tracker — create a test case |  | /admin/testing/cases |  | low | Admin Portal | Testing Tracker |  | 
 | Testing tracker — bulk import a batch of cases |  | /admin/testing/cases |  | low | Admin Portal | Testing Tracker |  | 
 | Testing tracker — create a testing project with a priority filter |  | /admin/testing/projects |  | low | Admin Portal | Testing Tracker |  | 
 | Testing tracker — mark checklist items successful/unsuccessful |  | /admin/testing/projects/{id} |  | low | Admin Portal | Testing Tracker |  | 
 | Appointment reminders — 24h-before reminder sends for a confirmed booking |  |  | booking ~24h out | medium | Reminders |  |  | 
 | Appointment reminders — 1h-before reminder sends |  |  | booking ~1h out | medium | Reminders |  |  | 
 | Appointment reminders — no duplicate sends across cron runs |  |  |  | low | Reminders |  |  | 
 | Appointment reminders — send failure surfaces on the calendar chip |  | /panel/calendar |  | low | Reminders |  |  | 
