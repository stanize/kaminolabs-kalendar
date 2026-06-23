-- ============================================================================
-- Kalendar — database schema  (onboarding scope)
-- ============================================================================
-- Usage:
--   1. Create a new, dedicated Supabase project for Kalendar.
--   2. Open SQL Editor → New query, paste this entire file, and run it.
--   3. Follow SETUP.md for Auth, Google OAuth, and env var configuration.
--
-- All tables are prefixed with "kalendar_" so they are clearly identifiable
-- inside the Supabase dashboard and easy to filter / export independently
-- of any other product that might share this Supabase organisation in future.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- kalendar_profiles
-- Extends auth.users with Kalendar-specific user data.
-- A row is created automatically via trigger whenever a user signs up
-- (covers both email/password and Google OAuth).
-- ----------------------------------------------------------------------------
create table if not exists public.kalendar_profiles (
  id                    uuid        primary key,
  nombre                text        not null default '',
  email                 text        not null,
  -- NULL = onboarding completed fully
  -- timestamp = user skipped onboarding at this time (show "complete your setup" banner)
  onboarding_skipped_at timestamptz,
  created_at            timestamptz not null default now()
);

alter table public.kalendar_profiles enable row level security;

create policy "User can read own profile"
  on public.kalendar_profiles for select
  using (true);

create policy "User can update own profile"
  on public.kalendar_profiles for update
  using (true)
  with check (true);

create policy "User can insert own profile"
  on public.kalendar_profiles for insert
  with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_businesses
-- ----------------------------------------------------------------------------
create table if not exists public.kalendar_businesses (
  id                       uuid    primary key default gen_random_uuid(),
  owner_id                 text    not null,
  nombre                   text    not null,
  tipo                     text    not null check (
    tipo in ('psico', 'nutri', 'fisio', 'belleza', 'fitness', 'coaching', 'tutorias', 'otro')
  ),
  ciudad                   text,
  slug                     text    not null unique,
  brand_color              text    not null default '#0d9488',
  onboarding_completed_at  timestamptz,
  created_at               timestamptz not null default now()
);

create index if not exists kalendar_businesses_owner_id_idx
  on public.kalendar_businesses (owner_id);

alter table public.kalendar_businesses enable row level security;

create policy "Public read access to businesses"
  on public.kalendar_businesses for select
  using (true);

create policy "Owner manages their business"
  on public.kalendar_businesses for all
  using  (owner_id = current_setting('request.jwt.claims', true)::json->>'sub')
  with check (owner_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ----------------------------------------------------------------------------
-- kalendar_services
-- ----------------------------------------------------------------------------
create table if not exists public.kalendar_services (
  id           uuid        primary key default gen_random_uuid(),
  business_id  uuid        not null references public.kalendar_businesses (id) on delete cascade,
  nombre       text        not null,
  duracion_min integer     not null check (duracion_min > 0),
  precio       numeric(10, 2) not null default 0 check (precio >= 0),
  orden        integer     not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists kalendar_services_business_id_idx
  on public.kalendar_services (business_id);

alter table public.kalendar_services enable row level security;

create policy "Public read access to services"
  on public.kalendar_services for select
  using (true);

create policy "Owner manages their services"
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
create table if not exists public.kalendar_business_hours (
  id           uuid    primary key default gen_random_uuid(),
  business_id  uuid    not null references public.kalendar_businesses (id) on delete cascade,
  dia          text    not null check (dia in ('lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom')),
  activo       boolean not null default false,
  hora_inicio  time,
  hora_fin     time,
  unique (business_id, dia)
);

create index if not exists kalendar_business_hours_business_id_idx
  on public.kalendar_business_hours (business_id);

alter table public.kalendar_business_hours enable row level security;

create policy "Public read access to business hours"
  on public.kalendar_business_hours for select
  using (true);

create policy "Owner manages their hours"
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
create table if not exists public.kalendar_team_members (
  id              uuid        primary key default gen_random_uuid(),
  business_id     uuid        not null references public.kalendar_businesses (id) on delete cascade,
  nombre          text        not null,
  rol             text,
  es_propietario  boolean     not null default false,
  orden           integer     not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists kalendar_team_members_business_id_idx
  on public.kalendar_team_members (business_id);

alter table public.kalendar_team_members enable row level security;

create policy "Public read access to team members"
  on public.kalendar_team_members for select
  using (true);

create policy "Owner manages their team"
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
-- End of onboarding schema.
-- ============================================================================
