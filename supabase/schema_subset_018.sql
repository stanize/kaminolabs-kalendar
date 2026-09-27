-- ============================================================================
-- schema_subset_018.sql — error-code-catalog (workflows/error-monitoring.md,
-- structured-event-log step): adds a curated "code" column to
-- kalendar_error_log (2026-09-27)
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql and every schema_subset_*.sql up
-- through 017 have already been run against this database. Adds ONE new
-- column + index to kalendar_error_log — touches no other table.
--
-- The exact same DDL below is ALSO folded into supabase/schema_001.sql so a
-- full from-scratch rebuild via schema_001.sql still produces the complete,
-- current schema on its own.
-- ============================================================================

alter table public.kalendar_error_log add column if not exists code text;

create index if not exists kalendar_error_log_code_idx on public.kalendar_error_log (code);
