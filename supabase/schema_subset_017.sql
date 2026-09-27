-- ============================================================================
-- schema_subset_017.sql — structured-event-log (workflows/error-monitoring.md):
-- a general-purpose structured log table (2026-09-27)
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql (and every schema_subset_*.sql up
-- through 016) have already been run against this database. Adds ONE new
-- table (kalendar_error_log) — touches no existing table.
--
-- The exact same DDL below is ALSO folded into supabase/schema_001.sql so a
-- full from-scratch rebuild via schema_001.sql still produces the complete,
-- current schema on its own.
-- ============================================================================

create table if not exists public.kalendar_error_log (
  id           uuid        primary key default gen_random_uuid(),
  source       text        not null check (source in ('server', 'client')),
  tag          text        not null, -- e.g. 'whatsapp', 'stripe-webhook', or an ad-hoc debug tag
  severity     text        not null check (severity in ('debug', 'info', 'warning', 'error', 'critical')),
  message      text        not null,
  stack        text,       -- populated for client JS errors; rarely for server-side logs
  business_id  uuid        references public.kalendar_businesses (id) on delete set null,
  context      jsonb,      -- catch-all per-call-site detail (booking id, IP, Stripe event id, etc.)
  environment  text,       -- 'production' | 'preview' | 'development', from VERCEL_ENV
  request_url  text,
  resolved     boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists kalendar_error_log_tag_idx on public.kalendar_error_log (tag);
create index if not exists kalendar_error_log_severity_idx on public.kalendar_error_log (severity);
create index if not exists kalendar_error_log_business_idx on public.kalendar_error_log (business_id);
create index if not exists kalendar_error_log_created_idx on public.kalendar_error_log (created_at);
create index if not exists kalendar_error_log_resolved_idx on public.kalendar_error_log (resolved);

alter table public.kalendar_error_log enable row level security;

drop policy if exists "ErrorLog: write" on public.kalendar_error_log;
create policy "ErrorLog: write"
  on public.kalendar_error_log for all using (true) with check (true);
