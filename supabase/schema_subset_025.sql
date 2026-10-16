-- schema_subset_025.sql
-- business-fields-snapshot (pdf-invoicing.md) — freezes every business-level
-- field the invoice PDF renders (name, legal/DNI/colegiada number, address,
-- signature, template id) onto the kalendar_invoices row at creation time,
-- so a later edit to the business never changes an already-generated
-- invoice. Previously the PDF route pulled these live from
-- kalendar_businesses on every render.
--
-- Touches only kalendar_invoices (new column). Existing invoice rows keep
-- the default '{}'::jsonb — re-rendering one of those will show blanks for
-- the business fields until it's re-created; this only affects pre-launch
-- test invoices, not a live concern. Safe to run again.

alter table public.kalendar_invoices
  add column if not exists business_snapshot jsonb not null default '{}'::jsonb;
