-- ============================================================================
-- schema_002.sql
-- ============================================================================
-- Extends the frozen schema_001.sql. Only ALTER TABLE ... ADD COLUMN IF NOT
-- EXISTS against existing (frozen) tables — non-destructive, safe to re-run.
-- Any brand-new tables introduced here get their own `drop table if exists`
-- entries below, per the schema-versioning rule (every new table needs a
-- matching drop in the same change).
-- ============================================================================

-- ── Demo accounts (workflows/presales-demo-onboarding.md) ──────────────────
-- A demo account is created through the exact same signup + onboarding flow
-- as a real clinic (dummy email Arun controls), then flagged after the fact.
-- Structurally identical to a real business row — only these columns
-- distinguish it, so demo and real accounts share every creation/edit path.
alter table public.kalendar_businesses
  add column if not exists is_demo boolean not null default false;

alter table public.kalendar_businesses
  add column if not exists demo_created_at timestamptz;

-- Source URL of the prospect's public website the demo was researched from
-- (clinic-prospect-scraper skill output). Null for real accounts. Also used
-- as the natural key if a demo is later re-scraped/refreshed.
alter table public.kalendar_businesses
  add column if not exists demo_source_url text;

-- Set on successful migration-execution (workflow step 4): the demo's slug
-- gets a "demo-" prefix applied at that moment, freeing the original slug
-- for the new real account. Null until migrated. Distinct from is_demo
-- itself so a demo can be flagged without necessarily being migrated yet.
alter table public.kalendar_businesses
  add column if not exists demo_migrated_at timestamptz;

-- Constrain demo-only columns to only make sense together with is_demo.
-- (Not enforced as a DB constraint yet — deferred until the migration-
-- execution write path exists and we know the exact update shape it needs.)
