-- ============================================================================
-- Kalendar — database schema  (onboarding scope)
-- ============================================================================
-- Usage:
--   1. Open Supabase SQL Editor → New query.
--   2. Paste this entire file and run it.
--   3. Follow SETUP.md for Auth, Google OAuth, and env var configuration.
--
-- All tables are prefixed with "kalendar_" so they are clearly identifiable
-- inside the Supabase dashboard.
-- All column names are in English.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Drop existing tables (cascade removes dependent objects: policies, indexes)
-- Order matters — children before parents.
-- ----------------------------------------------------------------------------
drop table if exists public.kalendar_team_members   cascade;
drop table if exists public.kalendar_business_hours cascade;
drop table if exists public.kalendar_services       cascade;
drop table if exists public.kalendar_businesses     cascade;
drop table if exists public.kalendar_profiles       cascade;

-- ----------------------------------------------------------------------------
-- kalendar_profiles
-- Extends Better Auth's "user" table with Kalendar-specific user data.
-- ----------------------------------------------------------------------------
create table public.kalendar_profiles (
  id                    uuid        primary key,
  name                  text        not null default '',
  email                 text        not null default '',
  -- NULL  = onboarding completed fully
  -- value = user skipped onboarding at this time → show "complete setup" banner
  onboarding_skipped_at timestamptz,
  created_at            timestamptz not null default now()
);

alter table public.kalendar_profiles enable row level security;

create policy "Profiles: public read"
  on public.kalendar_profiles for select using (true);

create policy "Profiles: owner insert"
  on public.kalendar_profiles for insert with check (true);

create policy "Profiles: owner update"
  on public.kalendar_profiles for update using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_businesses
-- ----------------------------------------------------------------------------
create table public.kalendar_businesses (
  id                      uuid        primary key default gen_random_uuid(),
  owner_id                text        not null,
  name                    text        not null,
  type                    text        not null check (
    type in ('psico', 'nutri', 'fisio', 'belleza', 'fitness', 'coaching', 'tutorias', 'otro')
  ),
  city                    text,
  slug                    text        not null unique,
  brand_color             text        not null default '#0d9488',
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now()
);

create index kalendar_businesses_owner_id_idx on public.kalendar_businesses (owner_id);

alter table public.kalendar_businesses enable row level security;

create policy "Businesses: public read"
  on public.kalendar_businesses for select using (true);

create policy "Businesses: owner write"
  on public.kalendar_businesses for all
  using  (owner_id = current_setting('request.jwt.claims', true)::json->>'sub')
  with check (owner_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ----------------------------------------------------------------------------
-- kalendar_services
-- ----------------------------------------------------------------------------
create table public.kalendar_services (
  id           uuid           primary key default gen_random_uuid(),
  business_id  uuid           not null references public.kalendar_businesses (id) on delete cascade,
  name         text           not null,
  duration_min integer        not null check (duration_min > 0),
  price        numeric(10, 2) not null default 0 check (price >= 0),
  sort_order   integer        not null default 0,
  created_at   timestamptz    not null default now()
);

create index kalendar_services_business_id_idx on public.kalendar_services (business_id);

alter table public.kalendar_services enable row level security;

create policy "Services: public read"
  on public.kalendar_services for select using (true);

create policy "Services: owner write"
  on public.kalendar_services for all
  using (exists (
    select 1 from public.kalendar_businesses b
    where b.id = kalendar_services.business_id
      and b.owner_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ))
  with check (exists (
    select 1 from public.kalendar_businesses b
    where b.id = kalendar_services.business_id
      and b.owner_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

-- ----------------------------------------------------------------------------
-- kalendar_business_hours
-- ----------------------------------------------------------------------------
create table public.kalendar_business_hours (
  id           uuid    primary key default gen_random_uuid(),
  business_id  uuid    not null references public.kalendar_businesses (id) on delete cascade,
  day          text    not null check (day in ('lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom')),
  active       boolean not null default false,
  start_time   time,
  end_time     time,
  unique (business_id, day)
);

create index kalendar_business_hours_business_id_idx on public.kalendar_business_hours (business_id);

alter table public.kalendar_business_hours enable row level security;

create policy "Hours: public read"
  on public.kalendar_business_hours for select using (true);

create policy "Hours: owner write"
  on public.kalendar_business_hours for all
  using (exists (
    select 1 from public.kalendar_businesses b
    where b.id = kalendar_business_hours.business_id
      and b.owner_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ))
  with check (exists (
    select 1 from public.kalendar_businesses b
    where b.id = kalendar_business_hours.business_id
      and b.owner_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

-- ----------------------------------------------------------------------------
-- kalendar_team_members
-- ----------------------------------------------------------------------------
create table public.kalendar_team_members (
  id           uuid        primary key default gen_random_uuid(),
  business_id  uuid        not null references public.kalendar_businesses (id) on delete cascade,
  name         text        not null,
  role         text,
  is_owner     boolean     not null default false,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now()
);

create index kalendar_team_members_business_id_idx on public.kalendar_team_members (business_id);

alter table public.kalendar_team_members enable row level security;

create policy "Team: public read"
  on public.kalendar_team_members for select using (true);

create policy "Team: owner write"
  on public.kalendar_team_members for all
  using (exists (
    select 1 from public.kalendar_businesses b
    where b.id = kalendar_team_members.business_id
      and b.owner_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ))
  with check (exists (
    select 1 from public.kalendar_businesses b
    where b.id = kalendar_team_members.business_id
      and b.owner_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

-- ============================================================================
-- End of schema.
-- ============================================================================
