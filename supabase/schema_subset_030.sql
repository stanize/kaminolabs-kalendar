-- schema_subset_030.sql
-- invoice-qr-verification (spec-invoice-qr.md) — adds the public invoice
-- verification URL, stored on the invoice row at generation time so a
-- re-download/re-send reproduces the exact same QR. Pre-VeriFACTU: always
-- the Kalendar-hosted verification page; the URL format changes later
-- when VeriFACTU is enabled per clinic, without a schema change.
--
-- New column only on the existing kalendar_invoices table. Safe to run
-- again.

alter table public.kalendar_invoices
  add column if not exists verification_url text;
