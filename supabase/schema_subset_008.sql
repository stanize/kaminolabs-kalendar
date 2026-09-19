-- ============================================================================
-- schema_subset_008.sql — booking-abuse-protection (public-booking.md):
-- shared per-endpoint, per-IP, per-day rate-limit counter (2026-09-19)
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql (and schema_subset_002.sql through
-- schema_subset_007.sql) have already been run against this database. Adds
-- ONE new table (kalendar_rate_limit_hits) and ONE new function
-- (increment_rate_limit_hit) — touches no existing table.
--
-- The exact same DDL below is ALSO folded into supabase/schema_001.sql so a
-- full from-scratch rebuild via schema_001.sql still produces the complete,
-- current schema on its own.
-- ============================================================================

create table if not exists public.kalendar_rate_limit_hits (
  endpoint text        not null,
  ip_key   text        not null,
  day      date        not null default current_date,
  count    int         not null default 0,
  primary key (endpoint, ip_key, day)
);

alter table public.kalendar_rate_limit_hits enable row level security;

create policy "RateLimitHits: write"
  on public.kalendar_rate_limit_hits for all using (true) with check (true);

-- Atomically bumps today's (endpoint, ip_key) counter and returns the new
-- total. A plain upsert can't reference the row's own current value from the
-- Supabase JS client, so this is a Postgres function instead — one round
-- trip, no read-then-write race between concurrent requests from the same IP.
create or replace function public.increment_rate_limit_hit(p_endpoint text, p_ip_key text)
returns int
language sql
as $$
  insert into public.kalendar_rate_limit_hits (endpoint, ip_key, day, count)
  values (p_endpoint, p_ip_key, current_date, 1)
  on conflict (endpoint, ip_key, day)
  do update set count = kalendar_rate_limit_hits.count + 1
  returning count;
$$;
