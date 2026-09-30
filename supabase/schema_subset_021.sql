-- ============================================================================
-- schema_subset_021.sql — workflows/admin-portal-tools.md's testing-tracker,
-- category/subcategory/expected-result/automatable fields + a stable seq_no
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql and every earlier schema_subset_*.sql
-- have already run against this database. Purely additive (new nullable
-- columns with safe defaults, plus a generated-identity column, on the
-- existing kalendar_test_cases table) — no data at risk, safe to re-run.
-- ============================================================================

alter table public.kalendar_test_cases
  add column if not exists category text;
alter table public.kalendar_test_cases
  add column if not exists subcategory text;
alter table public.kalendar_test_cases
  add column if not exists expected_result text;
alter table public.kalendar_test_cases
  add column if not exists automatable boolean not null default false;

-- Stable internal sequence number (distinct from the uuid `id`) — assigned
-- once, auto-incrementing, never reused. The bulk-import/export round-trip
-- includes it so a re-imported file UPDATES the matching existing row by
-- seq_no instead of creating a duplicate, and so Arun can diff two exports
-- by seq_no to see exactly which cases changed.
alter table public.kalendar_test_cases
  add column if not exists seq_no integer generated always as identity;

create unique index if not exists kalendar_test_cases_seq_no_idx on public.kalendar_test_cases (seq_no);
create index if not exists kalendar_test_cases_category_idx on public.kalendar_test_cases (category);
create index if not exists kalendar_test_cases_subcategory_idx on public.kalendar_test_cases (subcategory);
