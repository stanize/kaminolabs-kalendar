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
  id         uuid        primary key references auth.users (id) on delete cascade,
  nombre     text        not null default '',
  email      text        not null,
  created_at timestamptz not null default now()
);

alter table public.kalendar_profiles enable row level security;

create policy "User can read own profile"
  on public.kalendar_profiles for select
  using (auth.uid() = id);

create policy "User can update own profile"
  on public.kalendar_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger: auto-create a kalendar_profiles row on new sign-up
create or replace function public.kalendar_handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.kalendar_profiles (id, nombre, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nombre',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.kalendar_handle_new_user();

-- ----------------------------------------------------------------------------
-- kalendar_businesses
-- The business/practice created during onboarding.
-- Each business has a unique public slug (e.g. "centro-serena") used as the
-- public booking URL: kalendar.app/<slug>
-- ----------------------------------------------------------------------------
create table if not exists public.kalendar_businesses (
  id                       uuid    primary key default gen_random_uuid(),
  owner_id                 uuid    not null references public.kalendar_profiles (id) on delete cascade,
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

-- Public booking pages read this table without an auth session
create policy "Public read access to businesses"
  on public.kalendar_businesses for select
  using (true);

create policy "Owner manages their business"
  on public.kalendar_businesses for all
  using  (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- kalendar_services
-- The bookable services offered by a business.
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
      and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.kalendar_businesses b
    where b.id = kalendar_services.business_id
      and b.owner_id = auth.uid()
  ));

-- ----------------------------------------------------------------------------
-- kalendar_business_hours
-- Weekly availability — one row per day of the week per business.
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
      and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.kalendar_businesses b
    where b.id = kalendar_business_hours.business_id
      and b.owner_id = auth.uid()
  ));

-- ----------------------------------------------------------------------------
-- kalendar_team_members
-- People who deliver services at a business.
-- The owner is always index 0 (es_propietario = true) and is not deletable
-- from the onboarding wizard.
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
      and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.kalendar_businesses b
    where b.id = kalendar_team_members.business_id
      and b.owner_id = auth.uid()
  ));

-- ============================================================================
-- End of onboarding schema.
--
-- Future tables (out of current scope):
--   kalendar_bookings          — client-facing reservations
--   kalendar_availability_overrides — holiday / exception days
--   kalendar_notifications     — email / WhatsApp reminders
--   kalendar_payments          — Stripe payment records
-- ============================================================================
