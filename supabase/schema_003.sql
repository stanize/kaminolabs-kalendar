-- ============================================================================
-- Migration 003 — Cascade user deletion to all Kalendar data
-- Applied: manually via Supabase SQL editor
-- Depends on: schema_001.sql, schema_002.sql
-- ============================================================================
-- Goal: deleting a row from Better Auth's "user" table should automatically
-- remove EVERYTHING owned by that user:
--   user
--    ├─ account, session, verification        (already cascade — Better Auth)
--    ├─ kalendar_profiles            (id        → user.id)   [added here]
--    ├─ kalendar_support_tickets     (user_id   → user.id)   [added here]
--    └─ kalendar_businesses          (owner_id  → user.id)   [added here]
--         ├─ kalendar_services       (business_id)  already cascades
--         ├─ kalendar_business_hours (business_id)  already cascades
--         └─ kalendar_team_members   (business_id)  already cascades
--
-- After this migration:  delete from "user" where email = '...';  → full cleanup.
--
-- NOTE on id type: Better Auth's user.id is TEXT. owner_id/user_id are already
-- text; kalendar_profiles.id was uuid (inconsistent) and is corrected to text
-- below. If the diagnostic shows user.id is NOT text, stop and adjust before
-- running the rest.
--
--   select data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'user' and column_name = 'id';
--
-- The whole migration runs in a transaction: if any step fails, nothing applies.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Align kalendar_profiles.id with user.id (uuid → text)
-- ----------------------------------------------------------------------------
alter table public.kalendar_profiles
  alter column id type text using id::text;

-- ----------------------------------------------------------------------------
-- 2. Remove any pre-existing orphan rows so the FKs can be created cleanly.
--    (No-ops on a freshly wiped database.)
-- ----------------------------------------------------------------------------
delete from public.kalendar_profiles p
  where not exists (select 1 from public."user" u where u.id = p.id);

delete from public.kalendar_support_tickets t
  where not exists (select 1 from public."user" u where u.id = t.user_id);

-- Deleting orphan businesses cascades to their services/hours/team.
delete from public.kalendar_businesses b
  where not exists (select 1 from public."user" u where u.id = b.owner_id);

-- ----------------------------------------------------------------------------
-- 3. Add the cascading foreign keys (idempotent: drop-if-exists first)
-- ----------------------------------------------------------------------------
alter table public.kalendar_profiles
  drop constraint if exists kalendar_profiles_id_fkey;
alter table public.kalendar_profiles
  add  constraint kalendar_profiles_id_fkey
  foreign key (id) references public."user" (id) on delete cascade;

alter table public.kalendar_support_tickets
  drop constraint if exists kalendar_support_tickets_user_id_fkey;
alter table public.kalendar_support_tickets
  add  constraint kalendar_support_tickets_user_id_fkey
  foreign key (user_id) references public."user" (id) on delete cascade;

alter table public.kalendar_businesses
  drop constraint if exists kalendar_businesses_owner_id_fkey;
alter table public.kalendar_businesses
  add  constraint kalendar_businesses_owner_id_fkey
  foreign key (owner_id) references public."user" (id) on delete cascade;

commit;

-- ============================================================================
-- End of migration 003.
-- ============================================================================
