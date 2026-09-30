-- ============================================================================
-- schema_subset_020.sql — workflows/admin-portal-tools.md's testing-tracker
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql and every earlier schema_subset_*.sql
-- have already run against this database. Purely additive (three new
-- tables) — no existing table touched, no data at risk.
--
-- Admin-repo-only feature (manual regression-testing checklist for Arun),
-- but the tables live here per this repo's convention that ALL schema for
-- the shared Supabase project is consolidated in this repo's supabase/,
-- even for admin-only tables (see kalendar_error_log, kalendar_admin_users).
--
-- The exact same DDL below is ALSO folded into supabase/schema_001.sql so a
-- full from-scratch rebuild via schema_001.sql still produces the complete
-- schema on its own.
-- ============================================================================

-- ── kalendar_test_cases ──────────────────────────────────────────────────
-- Reusable test-case templates. Edited/added to over time, independent of
-- any one testing run.
create table if not exists public.kalendar_test_cases (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  description text,                 -- steps to follow; free text
  url         text,                 -- where to go; null = no specific page
  test_data   text,                 -- what to use; null = use generic data
  priority    text        check (priority in ('low', 'medium', 'high')), -- null = unranked
  created_by  text,                 -- admin user id who added it
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists kalendar_test_cases_priority_idx on public.kalendar_test_cases (priority);

alter table public.kalendar_test_cases enable row level security;

create policy "TestCases: write"
  on public.kalendar_test_cases for all using (true) with check (true);

-- ── kalendar_testing_projects ────────────────────────────────────────────
-- A named testing session ("dedicate one afternoon") — a point-in-time
-- checklist built from a set of test-case templates.
create table if not exists public.kalendar_testing_projects (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.kalendar_testing_projects enable row level security;

create policy "TestingProjects: write"
  on public.kalendar_testing_projects for all using (true) with check (true);

-- ── kalendar_testing_project_cases ───────────────────────────────────────
-- Checklist rows — one per (project, test case) at creation time. Live
-- reference to the template (not a snapshot) for v1, per the workflow
-- doc's noted lean. ON DELETE RESTRICT on test_case_id: a template that's
-- ever been included in a testing project can't just be silently deleted
-- out from under that project's history.
create table if not exists public.kalendar_testing_project_cases (
  id           uuid        primary key default gen_random_uuid(),
  project_id   uuid        not null references public.kalendar_testing_projects (id) on delete cascade,
  test_case_id uuid        not null references public.kalendar_test_cases (id) on delete restrict,
  status       text        not null default 'untested' check (status in ('untested', 'pass', 'fail')),
  tested_at    timestamptz,
  created_at   timestamptz not null default now()
);

create unique index if not exists kalendar_testing_project_cases_unique_idx
  on public.kalendar_testing_project_cases (project_id, test_case_id);
create index if not exists kalendar_testing_project_cases_project_idx
  on public.kalendar_testing_project_cases (project_id);

alter table public.kalendar_testing_project_cases enable row level security;

create policy "TestingProjectCases: write"
  on public.kalendar_testing_project_cases for all using (true) with check (true);
