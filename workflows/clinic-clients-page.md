# Workflow: Clinic Clients Page

The clinic's own directory of people they've booked — /panel/clients, currently a nav link with no page behind it. Distinct from the patient portal (patient-facing login) and distinct from Kalendar's own SaaS subscribers.

## Step: schema-foundation
Status: done
Criteria:
- kalendar_clients table exists — one row per (business, client), never shared across businesses even if the same person books with two different clinics
- Guest bookings always create a new row (no dedupe by email/phone, by design); manual bookings are meant to search existing rows via a client picker before creating a new one
- Denormalized counters exist (total_sessions, completed_count, no_show_count, cancelled_count, first_visit_at, last_visit_at), designed to be updated by the same action that changes a booking's result — not a trigger or cron
- kalendar_bookings.clinic_client_id soft-links a booking to a client row (nullable, on delete set null)
- patient_id on kalendar_clients is an optional soft link to a portal login (kalendar_patients) — carries no behavior today, just a future hook

## Step: client-linking-on-booking
Status: not_started
Criteria:
- Guest wizard booking creates (or the equivalent) a kalendar_clients row and sets clinic_client_id on the resulting booking
- Manual owner-created booking either links to an existing kalendar_clients row (via a client picker, searching by name/email/phone) or creates a new one if no match is chosen
- This is the actual blocker for everything else in this workflow and for calendar-management-past.md's client-session-history step — nothing downstream works until bookings are actually linked

## Step: denormalized-counters-updated
Status: not_started
Criteria:
- updateBookingResult (lib/actions/booking-owner.ts) updates kalendar_clients' total_sessions/completed_count/no_show_count/cancelled_count/last_visit_at when a booking's result changes — currently does NOT do this per its own code comment
- first_visit_at is set once, on the client's first-ever linked booking, not overwritten afterward

## Step: clients-list-page
Status: not_started
Criteria:
- /app/panel/clients/page.tsx exists (currently missing entirely — no directory at all)
- Lists all kalendar_clients rows for the caller's business, scoped correctly
- Each row shows name, contact info, and at-a-glance stats (total sessions, last visit)
- Searchable/filterable by name at minimum
- Empty state for a clinic with no clients yet

## Step: client-detail-view
Status: not_started
Criteria:
- Clicking a client opens a detail view showing their full booking history with this clinic
- Shows the denormalized counters (sessions, no-shows, cancellations) prominently
- Contact info editable from here (name, email, phone) — clinic's own record, separate from any patient-portal profile the same person might separately manage for themselves

## Notes / Deviations
- This workflow is the direct unblock for calendar-management-past.md's client-session-history step, which was previously not_started for the same underlying reason (clinic_client_id not populated). Once client-linking-on-booking and denormalized-counters-updated are done here, that step should be re-reviewed.
- The schema is already well-designed for this (kalendar_clients existed before any of the app code was written) — this is a case where the data model got ahead of the UI, not the other way around.
