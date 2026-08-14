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
- Clicking a client opens a "client 360" detail view scoped to the caller's business
- Upcoming appointments section (future bookings linked via clinic_client_id, not yet happened)
- Full appointment history section, distinguishing completed / no_show / cancelled per booking (join on clinic_client_id, same statuses as calendar-management-past.md's mark-result step)
- Denormalized counters (total_sessions, completed_count, no_show_count, cancelled_count, first_visit_at, last_visit_at) shown prominently as an at-a-glance summary rather than requiring the clinic to count from the history list themselves
- Contact info editable from here (name, email, phone) — clinic's own record, separate from any patient-portal profile the same person might separately manage for themselves

## Step: private-clinic-notes
Status: not_started
Criteria:
- New table kalendar_client_notes (not a single field on kalendar_clients) — one row per note, timestamped, so the clinic gets a running history ("what did we write in March vs. now") rather than one overwritable blob
- Columns: client_id (FK to kalendar_clients, on delete cascade), business_id (redundant with client's own business_id, but included directly for straightforward RLS/query scoping without a join), author user_id (which team member wrote it, if team_mode is team), body text, created_at
- STRICTLY PRIVATE, by design decision: notes are visible only to the clinic (owner + team members with panel access), never surfaced to the patient anywhere in the patient portal, never included in any email to the client, never referenced in an API response reachable from a patient-authenticated request. This applies even if the person the notes are about is also a registered patient-portal user via kalendar_clients.patient_id — the soft link to their portal login does not grant them note visibility.
- Free-text — intended for clinical/relationship context ("presenting problem," progress notes, anything the clinic wants to remember), not structured fields; no medical-record-specific validation or format assumed unless a future step decides otherwise
- Notes survive if the linked patient-portal account is ever deleted — this is the entire point of keeping kalendar_clients (and now kalendar_client_notes) structurally separate from kalendar_patients, with only an optional nullable soft link between them. Deleting a patient login must never cascade into deleting the clinic's own notes about that person.
- Shown on client-detail-view, most-recent-first, with the ability to add a new note; editing/deleting past notes TBD (may want append-only for a true audit trail — undecided)

## Notes / Deviations
- Data-durability principle behind this whole workflow, made explicit here since it came up directly in discussion: kalendar_clients (and kalendar_client_notes) are the clinic's own business records, structurally independent of kalendar_patients (the patient's own portal login). The only connection is an optional, nullable patient_id soft link. If a patient deletes their portal account, that link goes null — the clinic's history, counters, and private notes about that person are entirely unaffected. This is why no new parallel table was needed for "client 360" / notes — kalendar_clients already has the right shape, it just needs the UI and the notes table built on top.
- This workflow is the direct unblock for calendar-management-past.md's client-session-history step, which was previously not_started for the same underlying reason (clinic_client_id not populated). Once client-linking-on-booking and denormalized-counters-updated are done here, that step should be re-reviewed.
- The schema is already well-designed for this (kalendar_clients existed before any of the app code was written) — this is a case where the data model got ahead of the UI, not the other way around.
