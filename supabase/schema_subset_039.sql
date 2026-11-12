-- schema_subset_039.sql
-- For workflows/pdf-invoicing.md: professional-title-on-invoice step.
-- Adds a per-team-member professional title (e.g. "Podiatra") shown on
-- invoices, same scope as the existing professional_dni/
-- professional_college_number columns (provider-invoicing-fields,
-- schema_subset_027.sql). Does not touch any other table. Safe to run
-- again (add column if not exists).

alter table public.kalendar_team_members
  add column if not exists professional_title text;
