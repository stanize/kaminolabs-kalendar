-- schema_subset_026.sql
-- provider-signature-name (pdf-invoicing.md) — the provider's own personal
-- name, distinct from kalendar_businesses.name (the clinic/business name),
-- used for the invoice's "Fdo: {name}" signature line instead of the
-- clinic name. Falls back to the business name in app code when blank.
--
-- Touches only kalendar_businesses (new column). Safe to run again.

alter table public.kalendar_businesses
  add column if not exists professional_name text;
