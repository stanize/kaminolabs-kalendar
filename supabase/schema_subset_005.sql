-- ============================================================================
-- schema_subset_005.sql — public-booking.md (guest-immediate-confirm-with-
-- clinic-followup) + calendar-management-upcoming.md (pending-guest-requests)
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql (and schema_subset_002.sql,
-- schema_subset_003.sql, schema_subset_004.sql) have already been run
-- against this database. This file only ALTERs the existing kalendar_bookings
-- table — it does not drop or recreate it, so running this against an
-- existing database with real booking data is safe and does not lose any
-- rows.
--
-- The exact same column below is ALSO folded into supabase/schema_001.sql
-- (in kalendar_bookings' own create table statement) so a full from-scratch
-- rebuild via schema_001.sql still produces the complete schema on its own.
--
-- NOTE: this change also drops the 24h guest auto-expiry/confirm-by-link
-- flow. Any pre-existing 'pending_confirmation' guest booking (patient_id
-- null) left over from before this migration will no longer be auto-
-- cancelled by the (now-removed) sweep cron — review/confirm-or-cancel any
-- such rows manually after running this file.
-- ============================================================================

alter table public.kalendar_bookings
  add column if not exists clinic_reviewed_at timestamptz;
