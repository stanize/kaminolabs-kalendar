-- schema_subset_032.sql
-- appointment-panel-tabs (workflows/appointment-panel-tabs.md) — the
-- Cliente tab's new "Fecha de nacimiento" field. Does not touch anything
-- else — no other table affected.
--
-- Safe to run again.

alter table public.kalendar_clients
  add column if not exists date_of_birth date;
