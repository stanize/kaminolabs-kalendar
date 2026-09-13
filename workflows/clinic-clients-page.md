# Workflow: Clinic Clients Page

The clinic's own directory of people they've booked — /panel/clients. Distinct from the patient portal (patient-facing login) and distinct from Kalendar's own SaaS subscribers. Built end-to-end as of 2026-08-25 (commits 08fb869, b9fee9a, 07e8379) — was previously undocumented here despite being complete; see each step below for what shipped.

## Step: schema-foundation
Status: done
Criteria:
- kalendar_clients table exists — one row per (business, client), never shared across businesses even if the same person books with two different clinics
- Guest bookings always create a new row (no dedupe by email/phone, by design); manual bookings are meant to search existing rows via a client picker before creating a new one
- Denormalized counters exist (total_sessions, completed_count, no_show_count, cancelled_count, first_visit_at, last_visit_at), designed to be updated by the same action that changes a booking's result — not a trigger or cron
- kalendar_bookings.clinic_client_id soft-links a booking to a client row (nullable, on delete set null)
- patient_id on kalendar_clients is an optional soft link to a portal login (kalendar_patients) — carries no behavior today, just a future hook

## Step: client-linking-on-booking
Status: done
Criteria:
- Guest wizard booking creates (or the equivalent) a kalendar_clients row and sets clinic_client_id on the resulting booking
- Manual owner-created booking either links to an existing kalendar_clients row (via a client picker, searching by name/email/phone) or creates a new one if no match is chosen
- This is the actual blocker for everything else in this workflow and for calendar-management-past.md's client-session-history step — nothing downstream works until bookings are actually linked
- IMPLEMENTATION: lib/booking/client-link.ts's resolveClinicClientId() is the single resolution point, called from both submitBooking (public wizard) and the owner's appointment-modal.tsx. Authenticated patient: find-or-create by (business_id, patient_id) — one stable row accumulates their history. Guest: always creates a new row, no dedupe by email/phone (deliberate — see schema_001.sql's kalendar_clients comment, a guest has no identity Kalendar can trust). Owner-created bookings get a type-ahead client-picker (searchClients, lib/actions/clients.ts) debounced on the name field in appointment-modal.tsx; picking a result sets clinicClientId directly rather than going through resolveClinicClientId's guest-style creation.

## Step: denormalized-counters-updated
Status: done
Criteria:
- updateBookingResult (lib/actions/booking-owner.ts) updates kalendar_clients' total_sessions/completed_count/no_show_count/cancelled_count/last_visit_at when a booking's result changes — currently does NOT do this per its own code comment
- first_visit_at is set once, on the client's first-ever linked booking, not overwritten afterward
- IMPLEMENTATION: updateBookingResult reads the client's current counters, computes the bucket shift (a result changing from e.g. no_show to completed moves the count between buckets without touching total_sessions, which counts each booking's result exactly once), and writes back total_sessions/completed_count/no_show_count/cancelled_count. first_visit_at/last_visit_at only move on a 'completed' result — first_visit_at only backfills if unset or earlier than the current value, last_visit_at only advances forward.

## Step: clients-list-page
Status: done
Criteria:
- /app/panel/clients/page.tsx exists (currently missing entirely — no directory at all)
- Lists all kalendar_clients rows for the caller's business, scoped correctly
- Each row shows name, contact info, and at-a-glance stats (total sessions, last visit)
- Searchable/filterable by name at minimum
- Empty state for a clinic with no clients yet
- IMPLEMENTATION: app/panel/clients/page.tsx + components/panel/clients-list.tsx.

## Step: client-detail-view
Status: done
Criteria:
- Clicking a client opens a "client 360" detail view scoped to the caller's business
- Upcoming appointments section (future bookings linked via clinic_client_id, not yet happened)
- Full appointment history section, distinguishing completed / no_show / cancelled per booking (join on clinic_client_id, same statuses as calendar-management-past.md's mark-result step)
- Denormalized counters (total_sessions, completed_count, no_show_count, cancelled_count, first_visit_at, last_visit_at) shown prominently as an at-a-glance summary rather than requiring the clinic to count from the history list themselves
- Contact info editable from here (name, email, phone) — clinic's own record, separate from any patient-portal profile the same person might separately manage for themselves
- IMPLEMENTATION: app/panel/clients/[id]/page.tsx + components/panel/client-detail-view.tsx. Also gained a "Bonos" card (bonos.md's client-page-bono-summary) placed between Contacto and Próximas citas, built after this step.

## Step: private-clinic-notes
Status: done
Criteria:
- New table kalendar_client_notes (not a single field on kalendar_clients) — one row per note, timestamped, so the clinic gets a running history ("what did we write in March vs. now") rather than one overwritable blob
- Columns: client_id (FK to kalendar_clients, on delete cascade), business_id (redundant with client's own business_id, but included directly for straightforward RLS/query scoping without a join), author user_id (which team member wrote it, if team_mode is team), body text, created_at
- STRICTLY PRIVATE, by design decision: notes are visible only to the clinic (owner + team members with panel access), never surfaced to the patient anywhere in the patient portal, never included in any email to the client, never referenced in an API response reachable from a patient-authenticated request. This applies even if the person the notes are about is also a registered patient-portal user via kalendar_clients.patient_id — the soft link to their portal login does not grant them note visibility.
- Free-text — intended for clinical/relationship context ("presenting problem," progress notes, anything the clinic wants to remember), not structured fields; no medical-record-specific validation or format assumed unless a future step decides otherwise
- Notes survive if the linked patient-portal account is ever deleted — this is the entire point of keeping kalendar_clients (and now kalendar_client_notes) structurally separate from kalendar_patients, with only an optional nullable soft link between them. Deleting a patient login must never cascade into deleting the clinic's own notes about that person.
- Shown on client-detail-view, most-recent-first, with the ability to add a new note. DECIDED: notes are editable/deletable by the clinic (not append-only for now) — revisit append-only later if a real need for a strict audit trail emerges.
- IMPLEMENTATION: kalendar_client_notes in schema_001.sql, RLS enabled. Rendered on client-detail-view.tsx.

## Notes / Deviations
- Data-durability principle behind this whole workflow, made explicit here since it came up directly in discussion: kalendar_clients (and kalendar_client_notes) are the clinic's own business records, structurally independent of kalendar_patients (the patient's own portal login). The only connection is an optional, nullable patient_id soft link. If a patient deletes their portal account, that link goes null — the clinic's history, counters, and private notes about that person are entirely unaffected. This is why no new parallel table was needed for "client 360" / notes — kalendar_clients already has the right shape, it just needs the UI and the notes table built on top.
- This workflow is the direct unblock for calendar-management-past.md's client-session-history step, which was previously not_started for the same underlying reason (clinic_client_id not populated). Once client-linking-on-booking and denormalized-counters-updated are done here, that step should be re-reviewed.
- The schema is already well-designed for this (kalendar_clients existed before any of the app code was written) — this is a case where the data model got ahead of the UI, not the other way around.
