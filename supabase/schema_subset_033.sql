-- schema_subset_033.sql
-- bea-feedback-medication-field — a free-text "Medicación" field per
-- client, plain textarea, explicit save (same shape as the client's
-- Comentarios/notes field, not a new table, not rich text). Does NOT
-- touch bonos in any way — this is purely additive, unrelated to the
-- bonos_enabled flag.
--
-- Safe to run again.

alter table public.kalendar_clients
  add column if not exists medication text;
