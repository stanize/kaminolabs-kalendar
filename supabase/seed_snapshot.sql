-- ============================================================================
-- Kalendar — snapshot/restore mechanism (for test-seed workflow)
-- ============================================================================
-- Purpose: let dev-phase DB resets (schema_better_auth_001.sql +
-- schema_001.sql) be undone for whichever tables are considered "settled",
-- without hand-authoring insert data and without re-doing onboarding.
--
-- NOT part of schema_001.sql / schema_better_auth_001.sql on purpose: these
-- objects (tables + functions) must survive both reset scripts, so they are
-- managed entirely separately and never appear in either drop list.
--
-- SCOPE (edit as modules stabilize):
--   Currently covers: user, account, user_roles, kalendar_businesses,
--   kalendar_services, kalendar_team_members, kalendar_business_hours.
--   A table is added here only once its column shape is considered settled.
--   When a module stabilizes, add its mirror table + extend both functions
--   below (see the pattern already used for the tables above).
--
-- Usage:
--   select public.seed_snapshot_take();     -- capture current state
--   select public.seed_snapshot_restore();  -- after a reset, bring it back
--
-- Scoping logic: snapshots every row in kalendar_businesses (however many
-- test clinics exist at snapshot time — no hardcoded email list), plus their
-- services/team/hours, plus whichever user/account/user_roles rows belong
-- to those businesses' owners.
-- ============================================================================

-- ── Mirror tables (must track the live schema of the tables they shadow) ───

create table if not exists public.seed_snapshot_user (
  id               text        primary key,
  name             text        not null,
  email            text        not null,
  "emailVerified"  boolean     not null,
  image            text,
  "createdAt"      timestamp   not null,
  "updatedAt"      timestamp   not null
);

create table if not exists public.seed_snapshot_account (
  id                        text        primary key,
  "accountId"               text        not null,
  "providerId"              text        not null,
  "userId"                  text        not null,
  "accessToken"             text,
  "refreshToken"            text,
  "idToken"                 text,
  "accessTokenExpiresAt"    timestamp,
  "refreshTokenExpiresAt"   timestamp,
  scope                     text,
  password                  text,
  "createdAt"               timestamp   not null,
  "updatedAt"               timestamp   not null
);

create table if not exists public.seed_snapshot_user_roles (
  user_id    text        not null,
  role       text        not null,
  created_at timestamptz not null,
  primary key (user_id, role)
);

create table if not exists public.seed_snapshot_kalendar_businesses (
  id                      uuid        primary key,
  owner_id                text        not null,
  name                    text        not null,
  type                    text        not null,
  legal_id                text,
  address_street          text        not null,
  address_number          text        not null,
  address_additional      text,
  city                    text        not null,
  address_postal_code     text        not null,
  address_province        text        not null,
  address_country         text        not null,
  phone_country_code      text        not null,
  phone_number            text        not null,
  contact_email           text        not null,
  slug                    text        not null,
  slug_status             text        not null,
  slug_flag_reason        text,
  slug_reviewed_at        timestamptz,
  slug_reviewed_by        text,
  brand_color             text        not null,
  team_mode               text        not null,
  booking_window_months   smallint    not null,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null
);

create table if not exists public.seed_snapshot_kalendar_services (
  id           uuid        primary key,
  business_id  uuid        not null,
  name         text        not null,
  duration_min integer     not null,
  price        numeric     not null,
  sort_order   integer     not null,
  created_at   timestamptz not null
);

create table if not exists public.seed_snapshot_kalendar_team_members (
  id          uuid        primary key,
  business_id uuid        not null,
  name        text        not null,
  role        text,
  is_owner    boolean     not null,
  sort_order  integer     not null,
  created_at  timestamptz not null
);

create table if not exists public.seed_snapshot_kalendar_business_hours (
  id          uuid        primary key,
  business_id uuid        not null,
  day         text        not null,
  start_time  time        not null,
  end_time    time        not null,
  sort_order  integer     not null,
  created_at  timestamptz not null
);

-- ── Take snapshot ────────────────────────────────────────────────────────
create or replace function public.seed_snapshot_take()
returns text
language plpgsql
as $$
declare
  v_business_count int;
  v_service_count  int;
  v_team_count     int;
  v_hours_count    int;
  v_user_count     int;
begin
  truncate public.seed_snapshot_kalendar_businesses;
  truncate public.seed_snapshot_kalendar_services;
  truncate public.seed_snapshot_kalendar_team_members;
  truncate public.seed_snapshot_kalendar_business_hours;
  truncate public.seed_snapshot_user;
  truncate public.seed_snapshot_account;
  truncate public.seed_snapshot_user_roles;

  insert into public.seed_snapshot_kalendar_businesses
  select
    id, owner_id, name, type, legal_id,
    address_street, address_number, address_additional,
    city, address_postal_code, address_province, address_country,
    phone_country_code, phone_number, contact_email,
    slug, slug_status, slug_flag_reason, slug_reviewed_at, slug_reviewed_by,
    brand_color, team_mode, booking_window_months, onboarding_completed_at, created_at
  from public.kalendar_businesses;

  insert into public.seed_snapshot_kalendar_services
  select id, business_id, name, duration_min, price, sort_order, created_at
  from public.kalendar_services
  where business_id in (select id from public.kalendar_businesses);

  insert into public.seed_snapshot_kalendar_team_members
  select id, business_id, name, role, is_owner, sort_order, created_at
  from public.kalendar_team_members
  where business_id in (select id from public.kalendar_businesses);

  insert into public.seed_snapshot_kalendar_business_hours
  select id, business_id, day, start_time, end_time, sort_order, created_at
  from public.kalendar_business_hours
  where business_id in (select id from public.kalendar_businesses);

  insert into public.seed_snapshot_user
  select * from public."user"
  where id in (select owner_id from public.kalendar_businesses);

  insert into public.seed_snapshot_account
  select * from public.account
  where "userId" in (select owner_id from public.kalendar_businesses);

  insert into public.seed_snapshot_user_roles
  select * from public.user_roles
  where user_id in (select owner_id from public.kalendar_businesses);

  select count(*) into v_business_count from public.seed_snapshot_kalendar_businesses;
  select count(*) into v_service_count from public.seed_snapshot_kalendar_services;
  select count(*) into v_team_count from public.seed_snapshot_kalendar_team_members;
  select count(*) into v_hours_count from public.seed_snapshot_kalendar_business_hours;
  select count(*) into v_user_count from public.seed_snapshot_user;

  return format(
    'Snapshotted %s business(es), %s service(s), %s team member(s), %s hours row(s), %s owner account(s).',
    v_business_count, v_service_count, v_team_count, v_hours_count, v_user_count
  );
end;
$$;

-- ── Restore snapshot ─────────────────────────────────────────────────────
-- Resolves each snapshotted owner to an existing live user with the same
-- email if one already exists (e.g. re-created via a different login
-- surface, such as the admin portal, after a reset) instead of crashing on
-- the user table's email-uniqueness constraint. Businesses/services/team/
-- hours always follow the resolved id; account/user_roles rows are only
-- restored for genuinely newly-inserted users — a pre-existing account is
-- never touched or reassigned. Like any plpgsql function, an unhandled
-- error here rolls back everything the call did (no partial restores).
create or replace function public.seed_snapshot_restore()
returns text
language plpgsql
as $$
declare
  v_business_count int;
  v_service_count  int;
  v_team_count     int;
  v_hours_count    int;
  v_remapped_count int;
begin
  create temporary table tmp_owner_map (
    old_id text primary key,
    new_id text not null,
    remapped boolean not null
  ) on commit drop;

  insert into tmp_owner_map (old_id, new_id, remapped)
  select
    s.id,
    coalesce(existing.id, s.id),
    (existing.id is not null and existing.id != s.id)
  from public.seed_snapshot_user s
  left join public."user" existing on existing.email = s.email;

  insert into public."user"
  select s.*
  from public.seed_snapshot_user s
  join tmp_owner_map m on m.old_id = s.id and m.remapped = false
  on conflict (id) do nothing;

  insert into public.account
  select a.*
  from public.seed_snapshot_account a
  join tmp_owner_map m on m.old_id = a."userId" and m.remapped = false
  on conflict (id) do nothing;

  insert into public.user_roles
  select r.*
  from public.seed_snapshot_user_roles r
  join tmp_owner_map m on m.old_id = r.user_id and m.remapped = false
  on conflict (user_id, role) do nothing;

  insert into public.kalendar_businesses (
    id, owner_id, name, type, legal_id,
    address_street, address_number, address_additional,
    city, address_postal_code, address_province, address_country,
    phone_country_code, phone_number, contact_email,
    slug, slug_status, slug_flag_reason, slug_reviewed_at, slug_reviewed_by,
    brand_color, team_mode, booking_window_months, onboarding_completed_at, created_at
  )
  select
    s.id, m.new_id, s.name, s.type, s.legal_id,
    s.address_street, s.address_number, s.address_additional,
    s.city, s.address_postal_code, s.address_province, s.address_country,
    s.phone_country_code, s.phone_number, s.contact_email,
    s.slug, s.slug_status, s.slug_flag_reason, s.slug_reviewed_at, s.slug_reviewed_by,
    s.brand_color, s.team_mode, s.booking_window_months, s.onboarding_completed_at, s.created_at
  from public.seed_snapshot_kalendar_businesses s
  join tmp_owner_map m on m.old_id = s.owner_id
  on conflict (id) do nothing;

  insert into public.kalendar_services (id, business_id, name, duration_min, price, sort_order, created_at)
  select id, business_id, name, duration_min, price, sort_order, created_at
  from public.seed_snapshot_kalendar_services
  on conflict (id) do nothing;

  insert into public.kalendar_team_members (id, business_id, name, role, is_owner, sort_order, created_at)
  select id, business_id, name, role, is_owner, sort_order, created_at
  from public.seed_snapshot_kalendar_team_members
  on conflict (id) do nothing;

  insert into public.kalendar_business_hours (id, business_id, day, start_time, end_time, sort_order, created_at)
  select id, business_id, day, start_time, end_time, sort_order, created_at
  from public.seed_snapshot_kalendar_business_hours
  on conflict (id) do nothing;

  -- Belt-and-braces: every restored business owner has the 'clinic' role,
  -- even if a snapshot predates that assignment, or the owner was remapped.
  insert into public.user_roles (user_id, role)
  select owner_id, 'clinic' from public.kalendar_businesses
  on conflict (user_id, role) do nothing;

  select count(*) into v_business_count from public.kalendar_businesses;
  select count(*) into v_service_count from public.kalendar_services;
  select count(*) into v_team_count from public.kalendar_team_members;
  select count(*) into v_hours_count from public.kalendar_business_hours;
  select count(*) into v_remapped_count from tmp_owner_map where remapped;

  return format(
    'Restored. kalendar_businesses: %s row(s); kalendar_services: %s row(s); kalendar_team_members: %s row(s); kalendar_business_hours: %s row(s); user: %s row(s). %s owner(s) remapped to a pre-existing account by email.',
    v_business_count, v_service_count, v_team_count, v_hours_count, (select count(*) from public."user"), v_remapped_count
  );
end;
$$;
