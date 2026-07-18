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
--   kalendar_services.
--   A table is added here only once its column shape is considered settled
--   — a table mid-iteration (e.g. still-being-built kalendar_services) is
--   deliberately left OUT, so schema changes there don't require touching
--   this file. When a module stabilizes, add its mirror table + extend both
--   functions below (see the pattern already used for kalendar_businesses).
--
-- Usage:
--   select public.seed_snapshot_take();     -- capture current state
--   select public.seed_snapshot_restore();  -- after a reset, bring it back
--
-- Scoping logic: snapshots every row in kalendar_businesses (however many
-- test clinics exist at snapshot time — no hardcoded email list), plus
-- whichever user/account/user_roles rows belong to those businesses' owners.
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

-- ── Take snapshot ────────────────────────────────────────────────────────
create or replace function public.seed_snapshot_take()
returns text
language plpgsql
as $$
declare
  v_business_count int;
  v_service_count  int;
  v_user_count     int;
begin
  truncate public.seed_snapshot_kalendar_businesses;
  truncate public.seed_snapshot_kalendar_services;
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
  select count(*) into v_user_count from public.seed_snapshot_user;

  return format('Snapshotted %s business(es), %s service(s), %s owner account(s).', v_business_count, v_service_count, v_user_count);
end;
$$;

-- ── Restore snapshot ─────────────────────────────────────────────────────
create or replace function public.seed_snapshot_restore()
returns text
language plpgsql
as $$
declare
  v_business_count int;
  v_service_count  int;
  v_user_count     int;
begin
  insert into public."user"
  select * from public.seed_snapshot_user
  on conflict (id) do nothing;

  insert into public.account
  select * from public.seed_snapshot_account
  on conflict (id) do nothing;

  insert into public.user_roles
  select * from public.seed_snapshot_user_roles
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
    id, owner_id, name, type, legal_id,
    address_street, address_number, address_additional,
    city, address_postal_code, address_province, address_country,
    phone_country_code, phone_number, contact_email,
    slug, slug_status, slug_flag_reason, slug_reviewed_at, slug_reviewed_by,
    brand_color, team_mode, booking_window_months, onboarding_completed_at, created_at
  from public.seed_snapshot_kalendar_businesses
  on conflict (id) do nothing;

  insert into public.kalendar_services (id, business_id, name, duration_min, price, sort_order, created_at)
  select id, business_id, name, duration_min, price, sort_order, created_at
  from public.seed_snapshot_kalendar_services
  on conflict (id) do nothing;

  -- Belt-and-braces: every restored business owner has the 'clinic' role,
  -- even if a snapshot predates that assignment.
  insert into public.user_roles (user_id, role)
  select owner_id, 'clinic' from public.kalendar_businesses
  on conflict (user_id, role) do nothing;

  select count(*) into v_business_count from public.kalendar_businesses;
  select count(*) into v_service_count from public.kalendar_services;
  select count(*) into v_user_count from public."user";

  return format('Restored. kalendar_businesses: %s row(s); kalendar_services: %s row(s); user: %s row(s).', v_business_count, v_service_count, v_user_count);
end;
$$;
