-- schema_subset_041.sql
-- Fixes a pre-existing gap: kalendar_invoices.payment_method's check
-- constraint only allowed ('cash', 'card', 'bono'), while
-- kalendar_bookings.payment_method (the source value copied into an
-- invoice at creation time, lib/invoices/data.ts) allows the full set
-- ('cash', 'card', 'bono', 'bank_transfer', 'bizum', 'direct_debit',
-- 'paypal', 'other'). Any invoice for a booking paid via one of the
-- methods missing here failed to insert ("No se pudo crear la
-- factura."). Widens the invoices constraint to match bookings'. Does
-- not touch any other table. Safe to run again.

alter table public.kalendar_invoices
  drop constraint if exists kalendar_invoices_payment_method_check;

alter table public.kalendar_invoices
  add constraint kalendar_invoices_payment_method_check
  check (payment_method in ('cash', 'card', 'bono', 'bank_transfer', 'bizum', 'direct_debit', 'paypal', 'other'));
