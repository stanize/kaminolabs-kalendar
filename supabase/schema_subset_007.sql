-- ============================================================================
-- schema_subset_007.sql — unify guests/patients: claim existing guest/
-- walk-in history on account verification (2026-09)
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql (and schema_subset_002.sql through
-- schema_subset_006.sql) have already been run against this database. Only
-- ALTERs kalendar_patients and adds indexes — no existing rows are dropped
-- or touched, safe against a database with real data.
--
-- The exact same DDL below is ALSO folded into supabase/schema_001.sql (in
-- kalendar_patients' own create table statement, and alongside the other
-- kalendar_clients/user indexes) so a full from-scratch rebuild via
-- schema_001.sql still produces the complete, current schema on its own.
-- ============================================================================

alter table public.kalendar_patients
  add column if not exists claim_checked_at timestamptz;

create index if not exists kalendar_clients_unlinked_email_idx
  on public.kalendar_clients (lower(email))
  where patient_id is null and email is not null;

create index if not exists user_email_lower_idx
  on public."user" (lower(email));
