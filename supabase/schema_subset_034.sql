-- schema_subset_034.sql
-- custom-time-slots (workflows/custom-time-slots.md) — a new, additive,
-- opt-in layer on top of kalendar_business_hours. Does NOT touch Horarios,
-- Festivos, or Vacaciones data in any way.
--
-- Safe to run again.

create table if not exists public.kalendar_custom_time_slots (
  id              uuid        primary key default gen_random_uuid(),
  business_id     uuid        not null references public.kalendar_businesses (id) on delete cascade,
  label           text,
  -- empty = every day the business is open; non-empty = only these weekdays
  -- ("mon".."sun", same codes as kalendar_business_hours.day — not a DB enum).
  days            text[]      not null default '{}',
  -- empty = all providers; non-empty = this specific set (1 or more).
  -- No FK (Postgres arrays can't FK) — validated app-side against the
  -- caller's own kalendar_team_members on write.
  team_member_ids uuid[]      not null default '{}',
  -- "HH:MM" strings, clinic-entered order preserved.
  times           text[]      not null default '{}',
  sort_order      integer     not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists kalendar_custom_time_slots_business_id_idx
  on public.kalendar_custom_time_slots (business_id);
