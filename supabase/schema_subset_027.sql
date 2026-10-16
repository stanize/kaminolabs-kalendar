-- schema_subset_027.sql
-- provider-invoicing-fields (pdf-invoicing.md) — moves the professional's
-- DNI + professional college number from a single business-level field to
-- per-team-member fields, so a multi-provider clinic can have a different
-- DNI/colegiada number per person. Invoices now resolve these via the
-- booking's team_member_id instead of the business row. The member's own
-- `name` column (already existed) is used for the invoice's "Fdo:" line —
-- no separate name field needed.
--
-- kalendar_businesses.professional_dni/professional_college_number/
-- professional_name are left in place (deprecated, no longer read by the
-- app) rather than dropped, in case they hold real values from before this
-- move. Safe to run again.

alter table public.kalendar_team_members
  add column if not exists professional_dni text,
  add column if not exists professional_college_number text;
