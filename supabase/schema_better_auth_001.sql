-- ============================================================================
-- Kalendar — Better Auth tables (destructive reset)
-- ============================================================================
-- Drops and recreates the 4 tables managed by Better Auth:
-- user, session, account, verification.
--
-- WARNING: This is fully destructive. Dropping "user" cascades to ALL
-- kalendar_* tables (via FK ON DELETE CASCADE), so all clinic/patient/
-- booking data is wiped too. Run schema_001.sql afterwards to recreate
-- the kalendar_* tables.
--
-- Usage (full clean reset sequence):
--   1. Run this file  → wipes everything and recreates Better Auth tables
--   2. Run schema_001.sql → recreates all kalendar_* tables
--   3. Run: NOTIFY pgrst, 'reload schema';  → refreshes PostgREST cache
--   4. Clear browser cookies for kaminolabs.dev
-- ============================================================================

-- Drop in dependency order (children before parents).
drop table if exists public.verification cascade;
drop table if exists public.session      cascade;
drop table if exists public.account      cascade;
drop table if exists public."user"       cascade;

-- ----------------------------------------------------------------------------
-- user
-- Core identity record. Managed entirely by Better Auth — never insert or
-- update directly from application code.
-- ----------------------------------------------------------------------------
create table public."user" (
  id               text        primary key,
  name             text        not null,
  email            text        not null unique,
  "emailVerified"  boolean     not null default false,
  image            text,
  "createdAt"      timestamp   not null,
  "updatedAt"      timestamp   not null
);

-- ----------------------------------------------------------------------------
-- session
-- Active sessions. Better Auth creates/expires these; the app reads them
-- via auth.api.getSession() and the middleware cookie check.
-- ----------------------------------------------------------------------------
create table public.session (
  id              text        primary key,
  "expiresAt"     timestamp   not null,
  token           text        not null unique,
  "createdAt"     timestamp   not null,
  "updatedAt"     timestamp   not null,
  "ipAddress"     text,
  "userAgent"     text,
  "userId"        text        not null references public."user" (id) on delete cascade
);

-- ----------------------------------------------------------------------------
-- account
-- OAuth + email/password account linkages. One user can have multiple
-- accounts (e.g. email + Google). Better Auth manages this table entirely.
-- ----------------------------------------------------------------------------
create table public.account (
  id                        text        primary key,
  "accountId"               text        not null,
  "providerId"              text        not null,
  "userId"                  text        not null references public."user" (id) on delete cascade,
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

-- ----------------------------------------------------------------------------
-- verification
-- Email verification and magic-link tokens. Better Auth writes these when
-- it sends a verification email; deletes them once used or expired.
-- ----------------------------------------------------------------------------
create table public.verification (
  id            text        primary key,
  identifier    text        not null,
  value         text        not null,
  "expiresAt"   timestamp   not null,
  "createdAt"   timestamp,
  "updatedAt"   timestamp
);
