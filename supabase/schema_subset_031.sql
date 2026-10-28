-- schema_subset_031.sql
-- payment-cancellation-flow-expansion (workflows/calendar-management-past.md)
-- — expands the Cobrar modal's payment methods beyond cash/card/bono, and
-- adds a cancellation reason column for the new past-appointment-cancel
-- flow. Does NOT touch booking_status (no_show/cancelled stay exactly as
-- they are) or add any payments table — payment stays on kalendar_bookings
-- itself.
--
-- Safe to run again.

alter table public.kalendar_bookings
  drop constraint if exists kalendar_bookings_payment_method_check;

alter table public.kalendar_bookings
  add constraint kalendar_bookings_payment_method_check
  check (payment_method in ('cash', 'card', 'bono', 'bank_transfer', 'bizum', 'direct_debit', 'paypal', 'other'));

alter table public.kalendar_bookings
  add column if not exists cancellation_reason text;
