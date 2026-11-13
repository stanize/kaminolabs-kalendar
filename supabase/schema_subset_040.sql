-- schema_subset_040.sql
-- For workflows/pdf-invoicing.md: per-member-invoice-signature step.
-- Adds a per-team-member signature image URL, replacing the old single
-- business-level kalendar_businesses.signature_url for invoice rendering
-- (that column stays in place, deprecated/unread, rather than dropped
-- against live data — see lib/business/data.ts). Same scope as the
-- existing professional_dni/professional_college_number/professional_title
-- columns (provider-invoicing-fields, schema_subset_027.sql;
-- professional-title-on-invoice, schema_subset_039.sql). Does not touch
-- any other table. Safe to run again (add column if not exists).

alter table public.kalendar_team_members
  add column if not exists signature_url text;
