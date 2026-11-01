-- schema_subset_035.sql
-- For workflows/team-member-lifecycle.md: disable-instead-of-delete for
-- team members that already have bookings (past or future). Does not touch
-- any other table. Safe to run again.

alter table public.kalendar_team_members
  add column if not exists active boolean not null default true;
