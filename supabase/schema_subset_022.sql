-- ============================================================================
-- schema_subset_022.sql — bonos visibility flag + past-appointment paid_at
-- (clinic-configuration.md's bonos-visibility-toggle, calendar-management-
-- past.md's cobrar-button-and-paid-at)
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql and every earlier schema_subset_*.sql
-- have already run against this database. Purely additive (two new nullable/
-- defaulted columns, no existing data touched) — no data at risk, safe to
-- re-run. Touches only kalendar_businesses and kalendar_bookings.
-- ============================================================================

alter table public.kalendar_businesses
  add column if not exists bonos_enabled boolean not null default false;

alter table public.kalendar_bookings
  add column if not exists paid_at timestamptz;
