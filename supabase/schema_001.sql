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


-- ----------------------------------------------------------------------------
-- kalendar_support_tickets
-- Stores support requests submitted by authenticated users via the panel.
-- The help portal reads and updates this table (status, admin_notes).
-- ----------------------------------------------------------------------------
create type public.support_ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.support_ticket_category as enum ('billing', 'technical', 'feature_request', 'account', 'other');

create table public.kalendar_support_tickets (
  id           uuid                          primary key default gen_random_uuid(),
  user_id      text                          not null,
  user_email   text                          not null default '',
  subject      text                          not null,
  description  text                          not null,
  category     public.support_ticket_category not null default 'other',
  status       public.support_ticket_status   not null default 'open',
  attachments  text[]                        not null default '{}',
  -- Populated by the help-portal admin when responding to a ticket
  admin_notes  text,
  created_at   timestamptz                   not null default now(),
  updated_at   timestamptz                   not null default now()
);

create index kalendar_support_tickets_user_id_idx on public.kalendar_support_tickets (user_id);
create index kalendar_support_tickets_status_idx  on public.kalendar_support_tickets (status);

-- Auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger kalendar_support_tickets_updated_at
  before update on public.kalendar_support_tickets
  for each row execute function public.set_updated_at();

alter table public.kalendar_support_tickets enable row level security;

-- Users can only read and insert their own tickets (no delete/update from client)
create policy "Support: owner read"
  on public.kalendar_support_tickets for select
  using (true);

create policy "Support: owner insert"
  on public.kalendar_support_tickets for insert
  with check (true);

-- ============================================================================
-- support-attachments storage bucket
-- ============================================================================
-- Run the following in the Supabase dashboard → Storage:
--   1. Create a new bucket named "support-attachments" (public: true)
--   2. Set allowed MIME types: image/png, image/jpeg, image/webp, image/gif
--   3. Max file size: 5 MB
-- Or run via SQL:
--
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values (
--   'support-attachments',
--   'support-attachments',
--   true,
--   5242880,
--   array['image/png','image/jpeg','image/webp','image/gif']
-- ) on conflict (id) do nothing;

-- ============================================================================
-- End of schema.
-- ============================================================================
