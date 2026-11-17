# Kalendar: product description (for sales and video design)

Written 2026-11-17 from the repo's workflow files, code and live-data checks. It
describes what Kalendar does today, in plain language, so a sales or video
session can decide what to show and say. It is a description, not marketing copy.

**Read section 2 first.** Not everything that is built has been tested by the
founder yet, and a few things people assume exist do not. Show and claim only
what section 2 allows.

---

## 1. What Kalendar is

Kalendar is online appointment-booking software for independent professionals and
small clinics in Spain: physiotherapists, psychologists, nutritionists, podiatrists
and other health practitioners, beauty centres, fitness trainers, coaches and
tutors. It is made by KaminoLabs (a solo founder, Arun) and lives at
kalendar.kaminolabs.dev.

In one sentence: a professional gets a public booking page they can share, patients
book themselves on it, and the professional runs their whole practice (calendar,
clients, session packs, payments, invoices) from one panel.

- **The pain it replaces:** appointments scattered across WhatsApp chats, notes, a
  paper diary and a phone calendar.
- **The promise used in marketing:** "Tu agenda, ordenada y llena, en un solo
  lugar" (your calendar, organised and full, in one place).
- **Landing page copy today:** headline "Reservas para tu clínica, sin llamadas",
  subtitle "Tu página de reservas, lista en 2 minutos."
- **Language:** the product is in Spanish (clinic panel, booking page, emails). An
  English version exists for the website and booking pages, but guest-facing emails
  are currently always sent in Spanish.
- **Look:** soft teal brand colour (#0d9488), clean white cards, Bricolage Grotesque
  headings and Plus Jakarta Sans body text. Works on phones and desktops. The
  booking flow is phone-first.
- **Positioning:** a ready-made tool built for clinics, as an alternative to
  assembling Google Calendar or Calendly by hand.
- **Current commercial state:** a pilot with real clinics (a podiatry clinic run
  by "Bea" is the main reference customer). Subscription billing is not built (see
  section 11), and the outreach offer is a free 6-month pilot with direct feedback to
  the designer.

## 2. How to read the status labels in this document

Each feature is tagged:

- **[Live and tested]**: built and confirmed working by the founder.
- **[Built]**: the feature exists in the code and belongs to completed workflow steps, but I did not individually confirm a live test of it. Treat it as probably fine and glance at it before filming.
- **[Built, awaiting live test]**: code is complete, but the founder has not
  confirmed it in the running app. It probably works, but it could show a bug on
  camera. Test before filming.
- **[Partial]**: part works, part is a placeholder.
- **[Not built]**: does not exist. Do not show or promise it.

A rule for videos: only show [Live and tested] features without checking first.
Check [Built, awaiting live test] ones yourself before recording.

---

## 3. The journey of a new clinic

### 3.1 Landing page and sign-up [Built, awaiting live test for some parts]
- A marketing home page with a hero ("Reservas para tu clínica, sin llamadas"), an
  email field that carries into sign-up, a "who it's for" section, a "how it works"
  section and a closing call to action. Nav items: "Cómo funciona", "Para quién
  es", "Precios", "Iniciar sesión", "Empezar gratis".
- Sign-up by Google or by email and password. Email sign-ups must confirm their
  email: until they do, the panel shows a full-screen "confirm your email" gate.
  Google sign-ups arrive already verified.
- The same person cannot hold both a clinic account and a patient account with the
  same login; the app guides them away from that.

### 3.2 The onboarding wizard (6 steps) [Built]
Step titles, in Spanish:
1. **Crea tu cuenta**: free to start.
2. **Cuéntanos de tu negocio**: name, business type, address, phone, contact email.
   Business types: Fisioterapia, Fitness y entreno, Nutrición, Psicología, Coaching,
   Estética y belleza, Clases y tutorías, Otro.
3. **Añade tus servicios**: what people can book. Each business type comes with
   suggested starter services (for example physiotherapy offers "Primera
   valoración" at 50 min for €50), which can be edited. A service has a name, a
   duration and a whole-euro price.
4. **Define tu disponibilidad**: the weekly opening hours. The default is Monday to
   Friday, 09:00 to 17:00.
5. **Tu equipo**: working solo or with a team.
6. **¡Todo listo!**: "Tu página de reservas ya está activa."

A live preview of the booking page appears next to the wizard while the clinic
fills it in. On the panel home page a setup checklist tracks the same four setup
areas (Negocio, Servicios, Equipo, Disponibilidad) until they are done.

---

## 4. The patient's experience

### 4.1 The public booking page [Live and tested core, polish awaiting test]
Every clinic gets its own address: `kalendar.kaminolabs.dev/bookings/<clinic-name>`.
The clinic can change the address (the old one is remembered) and can show or share
it, including a QR code for the booking page on the Negocio page.

The booking wizard, designed for phones:
1. **Service**: the list shows duration and price for each option (for example
   "45 min · 45 €").
2. **Provider**: only shown if the clinic has more than one practitioner. Solo
   clinics skip this.
3. **Date and time**: available slots come from the clinic's real opening hours,
   existing bookings, holidays and time off. Times are in Madrid time.
4. **Details**: the patient books as a guest or logs in/registers inline (Google or
   email) without leaving the page.
5. **Confirmation**.

Two recent additions are built but awaiting the founder's live test: a visible
step-progress bar at the top (numbered dots connected by a line) and a recap card
("Resumen Cita") showing service, price, provider and date/time before the patient
enters contact details.

### 4.2 What happens when a patient books [Live and tested]
- The booking is **confirmed immediately**. There is no waiting period and no
  "confirm via email link" step any more.
- The patient gets a **confirmation email** (branded, in Spanish), which includes a
  calendar file (.ics) so the appointment can be added to their phone calendar. The
  .ics generation exists in the code; I did not verify whether it arrives as an
  attachment or a link, so check before showing it.
- The clinic gets a **new-booking email**.
- Guest bookings (people with no account) appear on the clinic calendar with a small
  blue dot until the clinic marks them reviewed with a "Contactado / Confirmado"
  button. This helps the clinic proactively contact unfamiliar guests.

### 4.3 Reminders [Live and tested]
- Two automatic reminder emails per confirmed appointment: **24 hours** and
  **1 hour** before.
- They are sent by a scheduled job that runs every 15 minutes and are never sent
  twice. If one fails to send, the clinic sees a marker on the calendar and the
  error in the appointment panel.
- Email only. WhatsApp reminders are not available (blocked, see section 11).

### 4.4 Cancelling [Built]
- A patient with an account can cancel from their portal. A guest cancels from a
  link in their confirmation email.
- Each clinic sets a **cancellation window** (default 24 hours; options 0, 12, 24,
  48, 72 hours or a custom value). Inside the window, a cancel attempt becomes a
  cancellation *request*: the slot stays held, and the clinic approves or denies it
  from a "Cancelaciones" tab on the calendar. Outside the window, cancelling is
  immediate and the patient gets a cancellation receipt.

### 4.5 The patient portal [Partly built]
At `/patients`, a patient can register or log in (Google or email), see their
bookings across clinics, cancel, manage their profile and see their own bonos
(session packs) with remaining sessions, read-only. A forgot-password flow exists.
The standalone `/patients` entry page is built but awaiting a live test.

---

## 5. The clinic panel

The left menu (Spanish): **Inicio, Calendario, Clientes, Bonos** (only if turned on),
**Facturas, Negocio, Servicios, Equipo, Disponibilidad, Ajustes, Soporte.** On
phones the menu opens from a hamburger button. Every add/edit surface opens as a
side panel that slides in from the right.

### 5.1 Inicio (home) [Built]
- A "today" widget: how many appointments today, or when the clinic next opens if
  today is closed or finished.
- A "this week" widget and a prompt about pending cancellation requests (only when
  there are any).
- The setup checklist for a new clinic, and a card with the clinic's booking link.

### 5.2 Calendario [Live and tested core, parts awaiting test]
- **Views:** day, week and month, with previous/next/today navigation. Week view is
  one column per practitioner, like Outlook. Tabs next to the grid cover the week
  view, the upcoming list, clients, cancellation requests and schedule conflicts.
- **Colour language:** teal chips for upcoming appointments, rose for past ones that
  still need resolving, slate for past ones that are resolved. A resolved past chip
  shows "Pagado" or "No-show".
- **Multi-practitioner clinics:** a dropdown picks which practitioners to show. With
  more than one selected, each day merges into a single column with small coloured
  dots per practitioner and a colour legend. A small "+" appears on a booking when
  another practitioner is free at that time, to book into it quickly. [Built,
  awaiting live test]
- **Creating an appointment:** click an empty slot or use the new-appointment
  panel. Pick a client from a search (name, email or phone) or create a new one.
  Choose service, practitioner, date, time and comments. The time field accepts
  typing. If the clinic really needs to double-book (a walk-in or an urgent case),
  it shows what is already booked in that slot and lets the clinic confirm
  "Reservar de todas formas". [Live and tested]
- **Appointment panel with four tabs:** **Cita** (details, payment, cancel), **Cliente**
  (editable contact details), **Historial** (that client's past visits) and **Notas**
  (private notes). A "+ Nueva cita" button in the header starts another appointment
  for the same client with the service, practitioner and client pre-filled.
  [Live and tested]
- **Editing and cancelling** upcoming appointments, including changing the service,
  practitioner, date or time inline. [Built]
- **Drag-to-reschedule:** [Built, awaiting live test]. Customers have asked for it.
  Do not rely on it in a demo until tested.

### 5.3 Cobrar: marking a past appointment as paid [Live and tested]
This is the day-to-day "close the appointment" action.
- A past, unresolved appointment shows two buttons: **Cobrar** and **No-show**.
- **Cobrar** opens a payment panel with methods (Efectivo, Tarjeta, Transferencia,
  Bizum, Domiciliado, PayPal, Otro; and, if the client has a session pack, the
  bono). Confirming marks the appointment both paid and completed in one tap and
  records when it was paid.
- **No-show** saves immediately.
- A small "Editar" link lets the clinic correct a mistake after the fact.
- Payment is recorded only. Kalendar does not process card payments or hold money.

### 5.4 Clientes: the clinic's client directory [Live and tested]
- A searchable list of everyone the clinic has booked, with total sessions and last
  visit at a glance.
- Opening a client shows a "client 360" page: contact details (name, email, phone,
  DNI, address) that the clinic can edit; upcoming appointments; full history with
  completed, no-show and cancelled marked; counters (total sessions, completed,
  no-shows, cancellations, first and last visit); and the client's session packs.
- **Private notes:** a timestamped running log per client. Only the clinic ever sees
  them. Notes can be edited and deleted. If a booking has a comment from the
  patient, it is automatically turned into a note linked to that appointment
  [Built, awaiting live test].
- Every booking gets a client record automatically, whether it came from the public
  page, WhatsApp or the panel.

### 5.5 Bonos: session packs [Live and tested]
A common pattern in Spanish clinics: sell a bundle at a discount.
- Optional. A clinic turns it on with an "Activar bonos" switch on the Servicios
  page; clinics that don't sell packs never see it.
- **Tipos de bono**: the clinic defines pack types (name, number of sessions, total
  price, active or retired). Example: "Bono de 10", 10 sessions for €380.
- **Bonos vendidos**: the clinic records a sale to a specific client. No payment is
  processed; it just records that the sale happened.
- **Automatic countdown:** when a visit is charged with a bono in Cobrar, one
  session is deducted automatically (the oldest active pack is chosen by default).
  Switching a visit away from a bono restores the session. Each sold pack has a
  usage history showing which appointments consumed it.
- Clients see their packs and remaining sessions on the client page and in the
  patient portal.

### 5.6 Facturas: invoices [Built, awaiting live test]
This is the most recent large feature. Every step below is coded but still waiting
for the founder's live test, and it is still being refined.
- **Creation:** after a successful Cobrar, a prompt asks "¿Quieres generar una
  factura?". Yes generates the invoice and emails it to the patient. One invoice per
  appointment. If the clinic says no, the paid appointment waits in a **Pendientes**
  tab on the Facturas page, so "no" means "later".
- **The invoice:** a PDF made inside the app, with a legally structured layout based
  on a real invoice from a podiatrist. It is a VAT-exempt (health service) template.
  It carries a sequential invoice number (e.g. 2026-0007), the clinic's and
  patient's details, the service and amount, payment method, and a "PAGADO" status.
  It shows the practitioner's professional title and colegiada (college) number and
  a signature image uploaded by the clinic. The signature and title are set per
  team member. An optional extra line ("concepto", for example "Quiropodia") can be
  picked from a clinic-defined list. A verification QR code is printed on the
  invoice; this is **not** VeriFactu.
- **Sending:** emailed to the patient with a link to the PDF. The clinic can send it
  to a different address, type a missing email inline, or **resend** later.
- **Facturas page:** every invoice with number, client, service, payment method,
  amount and send date, plus download. Filters by date range, service, payment
  method, client name and invoice number, and a free-text search across everything.
- **Settings > Facturación:** choose the template and upload the signature.
- **Limits today:** no editing, voiding or re-issuing invoices (a wrong invoice is
  handled manually). Invoices are not generated automatically on payment (an
  auto-invoice setting is on hold). No VeriFactu (Spain's tax-authority verified
  invoicing); see section 11.

### 5.7 Negocio: the business profile [Built]
Business name, type, address, phone, contact email, tax ID, logo upload, booking
page address with an availability check, a booking-link card with QR code, and the
WhatsApp booking settings (section 7).

### 5.8 Servicios [Built]
The service catalog: name, duration, whole-euro price, add/edit/remove. Includes the
"Activar bonos" switch.

### 5.9 Equipo: the team [Built, awaiting live test]
- Switch between working solo and working as a team; add practitioners and
  reorder them by dragging.
- Every action saves immediately, with no "Guardar cambios".
- A practitioner who has ever had a booking cannot be deleted. They are
  **disabled** instead: greyed out with a "Desactivado" badge, no longer bookable,
  but kept in history and invoices, and can be reactivated.
- Each practitioner can have a professional title and invoice signature.

### 5.10 Disponibilidad: availability [Mixed]
Four tabs:
- **Horarios**: weekly opening hours. [Built]
- **Horarios personalizados**: the clinic's exact fixed appointment times (for
  example 09:45, 10:30, 11:15, 12:00) instead of a generic grid, for all
  practitioners or chosen ones, on chosen days. [Live and tested]
- **Festivos**: public holidays entered as day and month, closing the clinic every
  year automatically. Manual entry only (no pre-loaded Spanish calendar).
  [Built, awaiting live test]
- **Vacaciones**: time off or absence for a single practitioner. [Built, awaiting
  live test]

The holidays and time-off work blocks slots on the public page, warns the clinic
when a new closure overlaps existing bookings, and keeps a persistent **Conflictos**
tab listing any overlaps. All of that is built but untested live.

### 5.11 Ajustes: settings [Partial]
- **Reservas**: the cancellation window. [Built]
- **Facturación**: template and signature. [Built, awaiting live test]
- **WhatsApp**: see section 7.
- **Idioma**, **Seguridad**: language and account security.
- **Notificaciones** and **Suscripción** are placeholders that read
  "Próximamente / Esta sección todavía no está disponible".
- Links to the Política de privacidad and Términos de servicio pages (drafted,
  awaiting final review).

### 5.12 Soporte: support tickets [Built, awaiting live test]
A clinic can raise a support or feature request ticket with a category, a subject, a
description and up to 5 image attachments, follow its progress, and exchange comments
with KaminoLabs. This replaces feedback sent informally over WhatsApp.

### 5.13 The "Pagos" page [Not built]
The route exists, but it is a placeholder for future payments from patients
(deposits, no-show charges). It does nothing today.

---

## 6. Emails Kalendar sends

All via a branded template, in Spanish:
- Patient verification email (sign-up) and password-reset email.
- Booking confirmation to the patient, with a calendar file.
- New-booking notification to the clinic.
- Cancellation receipt to the patient.
- 24-hour and 1-hour appointment reminders.
- Invoice email with a PDF link, and invoice resend.
- Notice to the clinic when its booking page address is changed by KaminoLabs.

---

## 7. Booking through WhatsApp [Partial: demoed, not production-ready]
A patient can book entirely inside a WhatsApp conversation with the clinic's own
WhatsApp number. It uses the same booking engine as the website, so the same slots,
the same client records and the same calendar apply.
- The patient taps through service, date and time using real tappable WhatsApp
  lists (with a "more" row for further dates) and a Confirm/Cancel button pair.
- Bookings created this way appear on the clinic calendar like any other.
- Setup: the clinic enters its Twilio account details and WhatsApp number under
  Negocio. The auth token is stored encrypted and never shown again. This requires a
  Twilio account.
- Status: tested live in Twilio's sandbox and demoed to a client on 2026-09-22.
  Production readiness is not done. WhatsApp reminders are blocked. Cancelling or
  rescheduling via WhatsApp is not included (new bookings only, for now). The
  conversation flow is still marked as awaiting final test.

---

## 8. Behind the scenes (what KaminoLabs uses)

Not shown to customers, but useful context for sales:
- An **admin portal** lets KaminoLabs create a **demo account** for a prospect,
  filled in from their public website (real clinic name, address, services),
  and generate realistic sample appointments and sample patients. The aim is to show a
  prospect their own clinic inside Kalendar. A planned flow would migrate an
  accepted demo into the prospect's real account.
- The admin portal also manages support tickets from all clinics, an error log,
  booking-address changes, and database migrations.
- An appointment-date cycler keeps demo calendars looking current.
- Reminder scheduling runs on the database itself rather than a third-party
  scheduler, which keeps send times accurate.

---

## 9. Trust, data and safety facts that are true today

- Data is stored in a managed Postgres database (Supabase) hosted in Europe
  (Frankfurt region). Login is handled by Better Auth (Google or email and password).
- Clinic notes are strictly private: never shown to patients, never emailed, and
  they survive even if a patient deletes their portal account.
- Every action on the clinic side is checked against the signed-in clinic's own
  business, so one clinic cannot see another's data.
- Draft privacy-policy and terms-of-service pages exist but are awaiting final
  review. **Do not claim full GDPR or legal compliance in marketing** until
  that is finished. A pre-launch security and performance audit has not been run
  yet.

---

## 10. What a clinic can do with Kalendar, as plain scenarios

1. **Get a booking page in minutes:** sign up, pick the business type, accept or edit
   the starter services, set the hours, and share the link or QR.
2. **A patient books at midnight from a phone:** no call, no message. The clinic's
   calendar already shows the booking in the morning.
3. **The patient doesn't forget:** a reminder email arrives a day before and an hour
   before.
4. **A busy week at a glance:** day, week or month, with each practitioner's column
   or merged colour-coded view.
5. **A walk-in or an urgent case:** the clinic books into an occupied slot after one
   confirmation.
6. **End of a visit:** tap Cobrar, choose Efectivo, Tarjeta or a bono, then choose
   whether to send an invoice.
7. **Selling a 10-session pack:** record the sale; each paid visit counts the pack
   down automatically; the patient can see what's left.
8. **Knowing the patient:** a client page with history, private notes, packs and
   contact details.
9. **Holidays and absences:** Christmas closes every year; one practitioner's
   holiday blocks only their slots.
10. **A patient who wants to cancel late:** inside the clinic's window, the clinic
    gets a request to approve or deny instead of losing the slot automatically.

---

## 11. What is not built or not safe to promise

- **No online payments from patients** (cards, deposits, prepayment).
  Payment is recorded manually only.
- **No subscription billing or pricing page.** The "Suscripción" settings tab is a
  placeholder. Any pricing talk should come from the founder.
- **No VeriFactu.** Spain's verified-invoicing regime is not implemented. The
  invoice carries a verification QR, which is a precursor and not the real thing.
  Do not describe invoices as VeriFactu-compliant.
- **No automatic invoicing** on payment (setting on hold), and no editing, voiding or
  re-issuing invoices.
- **No rescheduling by the patient** from the public page or portal (not started),
  no repeat-appointment shortcut.
- **No calendar import** from other tools (designed, not started).
- **No WhatsApp reminders** (blocked), and WhatsApp booking is not production-ready.
- **No SMS.**
- **No reports, notifications centre or integrations pages.** Not built.
- **No English emails.** Guest emails are Spanish only for now.
- **Drag-to-reschedule** is built but untested. Several customers have asked for it.
- **Clinic-level extras requested by customers and not yet built:** per-service
  price override at the moment of charging, multi-line invoices, configurable payment
  methods per country.

---

## 12. Recording notes for the sales video session

- A demo clinic called **Fisioterapia Nova** (physiotherapy, one practitioner, six
  services priced €30 to €60, three bono holders, a week of bookings with realistic
  Spanish names) was prepared on 2026-11-13 for filming.
- Strongest, safest clips today: the patient booking on a phone; the confirmation
  and calendar file; the reminder email; the calendar in week view; Cobrar; the
  client page; bonos counting down.
- Clips to test before filming: the invoice (Cobrar, then the invoice prompt, then
  the Facturas page and PDF), and the booking page's progress bar and recap card.
- Avoid on camera: Pagos, Notificaciones, Suscripción, WhatsApp booking, drag to
  reschedule, anything described as "awaiting live test" that has not been checked.
- Sales-video wording rule from the founder: describe what is present and gained
  ("Todas tus citas en un solo calendario"), and avoid negatives such as "no more",
  "without" and "don't", because therapists respond better to positive framing. No
  invented statistics: any number needs a verified source.

---

## 13. Glossary of Spanish labels used in the product

| Spanish | Meaning |
|---|---|
| Inicio | Home / dashboard |
| Calendario | Calendar |
| Clientes | Client directory |
| Bonos / Tipos de bono / Bonos vendidos | Session packs / pack types / sold packs |
| Facturas / Pendientes | Invoices / paid appointments without an invoice yet |
| Negocio | The business profile |
| Servicios | The service catalog |
| Equipo | The team |
| Disponibilidad | Availability (Horarios, Horarios personalizados, Festivos, Vacaciones) |
| Festivos / Vacaciones | Public holidays / time off for one practitioner |
| Ajustes | Settings |
| Soporte | Support |
| Cobrar | Charge / mark as paid |
| No-show | Patient did not attend |
| Cita | Appointment |
| Cancelaciones / Conflictos | Cancellation requests / schedule overlaps |
| Reservar de todas formas | Book anyway (override an occupied slot) |
| Contactado / Confirmado | Clinic has reviewed a guest booking |
| Colegiada / Nº colegiado | Professional college registration number |
| Efectivo, Tarjeta, Transferencia, Bizum, Domiciliado, PayPal | Cash, card, bank transfer, Bizum, direct debit, PayPal |
