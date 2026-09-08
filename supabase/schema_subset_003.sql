-- ============================================================================
-- schema_subset_003.sql — bonos.md (session-deduction-on-payment) +
-- calendar-management-past.md (mark-payment's payment-method piece)
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql (and schema_subset_002.sql) have
-- already been run against this database. This file only ALTERs the
-- existing kalendar_bookings table — it does not drop or recreate it, so
-- running this against an existing database with real booking data is
-- safe and does not lose any rows.
--
-- The exact same columns below are ALSO folded into supabase/schema_001.sql
-- (in kalendar_bookings' own create table statement) so a full
-- from-scratch rebuild via schema_001.sql still produces the complete
-- schema on its own.
-- ============================================================================

alter table public.kalendar_bookings
  add column if not exists payment_method   text check (payment_method in ('cash', 'card', 'bono')),
  add column if not exists bono_purchase_id uuid references public.kalendar_bono_purchases (id) on delete set null;
