-- schema_subset_036.sql
-- For workflows/force-insert-double-booking.md: drops the DB-level
-- slot-collision unique index so the clinic can deliberately force-insert
-- an appointment into an already-taken slot (Bea's feedback, via Arun).
-- The app layer now owns this check (overlap query + confirm dialog in
-- lib/actions/booking-owner.ts), same pattern as the existing
-- closures/time-off conflict-confirm flow — it's a soft warning, not a
-- hard constraint, same as everywhere else in this codebase. Does not
-- touch any other table. Safe to run again (drop if exists).

drop index if exists public.kalendar_bookings_active_slot_idx;
