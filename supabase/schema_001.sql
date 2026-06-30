-- ============================================================================
-- Kalendar — database schema (consolidated)
-- ============================================================================
-- Usage:
--   1. Open Supabase SQL Editor -> New query.
--   2. Paste this entire file and run it.
--   3. Follow SETUP.md for Auth, Google OAuth, and env var configuration.
--
-- Conventions:
--   * All tables are prefixed with "kalendar_".
--   * All identifiers and stored enum/code values are in ENGLISH so the project
--     is portable to any country without code changes. Country-specific display
--     copy lives only in the UI label layer, never in the database.
--   * Better Auth owns "user", "session", "account", "verification".
--   * Every table with a user-scoped column carries an ON DELETE CASCADE FK to
--     public."user"(id) in this same file.
--   * All app DB access uses the Supabase service-role key (Better Auth does not
--     issue Supabase JWTs), so RLS is the not the authorization boundary — the
--     app layer is. RLS stays enabled with permissive policies; the service-role
--     key bypasses them. The real authz check happens in server actions.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Drop existing tables (cascade removes dependent objects: policies, indexes).
-- Children before parents.
-- ----------------------------------------------------------------------------
drop table if exists public.kalendar_support_tickets cascade;
drop table if exists public.kalendar_bookings        cascade;
drop table if exists public.kalendar_team_members    cascade;
drop table if exists public.kalendar_business_hours  cascade;
drop table if exists public.kalendar_services        cascade;
drop table if exists public.kalendar_businesses      cascade;

drop type if exists public.support_ticket_status   cascade;
drop type if exists public.support_ticket_category cascade;
drop type if exists public.booking_status          cascade;

-- ----------------------------------------------------------------------------
-- kalendar_businesses
-- type/day style values are language-neutral English codes; the UI maps them
-- to localized labels.
-- ----------------------------------------------------------------------------
create table public.kalendar_businesses (
  id                      uuid        primary key default gen_random_uuid(),
  owner_id                text        not null
                                      references public."user" (id) on delete cascade,
  name                    text        not null,
  type                    text        not null check (
    type in (
      'psychology', 'nutrition', 'physiotherapy', 'beauty',
      'fitness', 'coaching', 'tutoring', 'other'
    )
  ),
  city                    text,
  slug                    text        not null unique,
  -- Slug moderation. Every slug is human-reviewed regardless of the automated
  -- screen at creation. 'active' = publicly bookable; 'pending_review' = held
  -- offline until an admin approves; 'rejected' = suspended, user must repick.
  -- The automated screen at creation sets the initial status: clean slugs go
  -- live ('active') but still await review (slug_reviewed_at is null); slugs
  -- that trip the reserved/profanity screen start 'pending_review'.
  slug_status             text        not null default 'active' check (
    slug_status in ('active', 'pending_review', 'rejected')
  ),
  slug_flag_reason        text,        -- why the auto-screen flagged it; null when clean
  slug_reviewed_at        timestamptz, -- null = awaiting human review (the review queue)
  slug_reviewed_by        text,        -- admin user id who actioned the review; null until reviewed
  brand_color             text        not null default '#0d9488',
  -- Solo vs multi-provider clinic. Controls whether per-member availability/
  -- service rows are materialized (team) or availability is the clinic hours
  -- read directly (solo).
  team_mode               text        not null default 'solo' check (
    team_mode in ('solo', 'team')
  ),
  -- How far ahead clients can book, in months (business-level policy).
  booking_window_months   smallint    not null default 1 check (
    booking_window_months in (1, 2, 3)
  ),
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now()
);

create index kalendar_businesses_owner_id_idx on public.kalendar_businesses (owner_id);
-- Review queue: rows not yet human-reviewed.
create index kalendar_businesses_review_queue_idx
  on public.kalendar_businesses (slug_reviewed_at)
  where slug_reviewed_at is null;

alter table public.kalendar_businesses enable row level security;

create policy "Businesses: public read"
  on public.kalendar_businesses for select using (true);
create policy "Businesses: write"
  on public.kalendar_businesses for all using (true) with check (true);

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
create policy "Services: write"
  on public.kalendar_services for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_business_hours
-- day is a language-neutral English weekday code.
-- ----------------------------------------------------------------------------
create table public.kalendar_business_hours (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references public.kalendar_businesses (id) on delete cascade,
  day         text        not null check (day in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  -- One row per working interval. A day is "open" if it has >= 1 interval and
  -- "closed" if it has none. Multiple rows per (business, day) enable split
  -- shifts (e.g. 09:00-14:00 and 16:00-20:00). end_time must be after start_time
  -- and intervals on the same day must not overlap (enforced in the app layer).
  start_time  time        not null,
  end_time    time        not null,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index kalendar_business_hours_business_id_idx on public.kalendar_business_hours (business_id);
create index kalendar_business_hours_business_day_idx on public.kalendar_business_hours (business_id, day);

alter table public.kalendar_business_hours enable row level security;

create policy "Hours: public read"
  on public.kalendar_business_hours for select using (true);
create policy "Hours: write"
  on public.kalendar_business_hours for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_team_members
-- ----------------------------------------------------------------------------
create table public.kalendar_team_members (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references public.kalendar_businesses (id) on delete cascade,
  name        text        not null,
  role        text,
  is_owner    boolean     not null default false,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index kalendar_team_members_business_id_idx on public.kalendar_team_members (business_id);

alter table public.kalendar_team_members enable row level security;

create policy "Team: public read"
  on public.kalendar_team_members for select using (true);
create policy "Team: write"
  on public.kalendar_team_members for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_bookings
-- Guest bookings made on the public /bookings/[slug] page.
--
-- Lifecycle (v1): a guest submits -> 'pending_confirmation' (holds the slot);
-- the client clicks the email link -> 'confirmed' (auto-accepted by default);
-- either party can cancel via tokenized link -> 'cancelled'; past confirmed
-- bookings become 'completed'. Owner review is surfaced in the panel calendar
-- but is not a required gate in v1.
--
-- Service details are SNAPSHOT onto the row (service_name/duration/price) so a
-- booking records what was actually booked and services can be edited/deleted
-- freely afterwards. team_member_id is null for solo businesses (or "cualquiera"
-- in team mode could pin a specific member at booking time).
--
-- Times are stored as timestamptz (UTC). The business timezone is Europe/Madrid
-- for now (future: derived from the business location).
-- ----------------------------------------------------------------------------
create type public.booking_status as enum (
  'pending_confirmation', 'confirmed', 'cancelled', 'completed'
);

create table public.kalendar_bookings (
  id                   uuid                  primary key default gen_random_uuid(),
  business_id          uuid                  not null references public.kalendar_businesses (id) on delete cascade,
  service_id           uuid                  references public.kalendar_services (id) on delete set null,
  team_member_id       uuid                  references public.kalendar_team_members (id) on delete set null,
  service_name         text                  not null,
  service_duration_min integer               not null check (service_duration_min > 0),
  service_price        numeric(10, 2)        not null default 0 check (service_price >= 0),
  starts_at            timestamptz           not null,
  ends_at              timestamptz           not null,
  status               public.booking_status not null default 'pending_confirmation',
  client_name          text                  not null,
  client_email         text                  not null,
  client_phone         text,
  -- The UI language the guest was using when they booked (session-only choice
  -- on the public page, not persisted anywhere else). Drives the language of
  -- the confirm/cancel pages and guest-facing emails for this booking.
  guest_locale         text                  not null default 'es' check (
    guest_locale in ('es', 'en')
  ),
  confirm_token        text                  not null unique,
  created_at           timestamptz           not null default now(),
  updated_at           timestamptz           not null default now()
);

create index kalendar_bookings_business_id_idx on public.kalendar_bookings (business_id);
create index kalendar_bookings_starts_at_idx   on public.kalendar_bookings (starts_at);
create index kalendar_bookings_token_idx       on public.kalendar_bookings (confirm_token);

-- Slot-collision guard: at most one active (pending or confirmed) booking per
-- provider+start. A null team_member_id (solo / unassigned) collapses to a
-- single "business chair" via coalesce to the all-zero uuid, so a solo business
-- cannot double-book the same start time. Cancelled/completed rows are excluded
-- so a freed slot can be rebooked.
create unique index kalendar_bookings_active_slot_idx
  on public.kalendar_bookings (
    business_id,
    coalesce(team_member_id, '00000000-0000-0000-0000-000000000000'::uuid),
    starts_at
  )
  where status in ('pending_confirmation', 'confirmed');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger kalendar_bookings_updated_at
  before update on public.kalendar_bookings
  for each row execute function public.set_updated_at();

alter table public.kalendar_bookings enable row level security;

create policy "Bookings: read"
  on public.kalendar_bookings for select using (true);
create policy "Bookings: write"
  on public.kalendar_bookings for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_support_tickets
-- Support requests submitted by authenticated users via the panel.
-- The help portal reads and updates this table (status, admin_notes).
-- ----------------------------------------------------------------------------
create type public.support_ticket_status   as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.support_ticket_category as enum ('billing', 'technical', 'feature_request', 'account', 'other');

create table public.kalendar_support_tickets (
  id          uuid                           primary key default gen_random_uuid(),
  user_id     text                           not null
                                             references public."user" (id) on delete cascade,
  user_email  text                           not null default '',
  subject     text                           not null,
  description text                           not null,
  category    public.support_ticket_category not null default 'other',
  status      public.support_ticket_status   not null default 'open',
  attachments text[]                         not null default '{}',
  admin_notes text,
  created_at  timestamptz                    not null default now(),
  updated_at  timestamptz                    not null default now()
);

create index kalendar_support_tickets_user_id_idx on public.kalendar_support_tickets (user_id);
create index kalendar_support_tickets_status_idx  on public.kalendar_support_tickets (status);

create trigger kalendar_support_tickets_updated_at
  before update on public.kalendar_support_tickets
  for each row execute function public.set_updated_at();

alter table public.kalendar_support_tickets enable row level security;

create policy "Support: read"
  on public.kalendar_support_tickets for select using (true);
create policy "Support: insert"
  on public.kalendar_support_tickets for insert with check (true);

-- ============================================================================
-- support-attachments storage bucket
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/gif']
) on conflict (id) do nothing;

-- ============================================================================
-- End of schema.
-- ============================================================================
