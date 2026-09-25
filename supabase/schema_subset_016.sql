-- ============================================================================
-- schema_subset_016.sql — recurring-public-holidays + provider-time-off
-- (workflows/holidays-and-time-off.md), 2026-09-25.
--
-- Adds ONE new table: kalendar_business_closures. Both row shapes (annual
-- "festivo" public holidays and one-off provider/clinic time-off) live in it
-- — see the table's header comment in schema_001.sql for the full rationale.
-- Data model + settings UI only in this pass — NOT yet consumed by the
-- slot-computation engine (availability-engine-integration, a later step).
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes schema_001.sql and schema_subset_002.sql through
-- schema_subset_015.sql have already been run. Additive only — creates one
-- new table, touches nothing else.
--
-- The exact same DDL is ALSO folded into supabase/schema_001.sql.
-- ============================================================================

create table if not exists public.kalendar_business_closures (
  id             uuid        primary key default gen_random_uuid(),
  business_id    uuid        not null references public.kalendar_businesses (id) on delete cascade,
  team_member_id uuid        references public.kalendar_team_members (id) on delete cascade,
  recurring      boolean     not null default false,
  month          smallint    check (month between 1 and 12),
  day            smallint    check (day between 1 and 31),
  start_date     date,
  end_date       date,
  start_time     time,
  end_time       time,
  label          text,
  created_at     timestamptz not null default now(),
  constraint kalendar_business_closures_recurring_shape check (
    (recurring = true  and month is not null and day is not null
                       and start_date is null and end_date is null)
    or
    (recurring = false and month is null and day is null
                        and start_date is not null and end_date is not null)
  ),
  constraint kalendar_business_closures_date_order check (
    start_date is null or end_date is null or end_date >= start_date
  ),
  constraint kalendar_business_closures_time_order check (
    start_time is null or end_time is null or end_time > start_time
  ),
  constraint kalendar_business_closures_recurring_clinic_wide check (
    recurring = false or team_member_id is null
  )
);

create index if not exists kalendar_business_closures_business_id_idx
  on public.kalendar_business_closures (business_id);
create index if not exists kalendar_business_closures_team_member_idx
  on public.kalendar_business_closures (team_member_id);

alter table public.kalendar_business_closures enable row level security;

drop policy if exists "Closures: public read" on public.kalendar_business_closures;
create policy "Closures: public read"
  on public.kalendar_business_closures for select using (true);

drop policy if exists "Closures: write" on public.kalendar_business_closures;
create policy "Closures: write"
  on public.kalendar_business_closures for all using (true) with check (true);
