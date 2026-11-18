-- schema_subset_043.sql
-- custom-time-slots, "Frecuencia" rules can now hold SEVERAL ranges (e.g.
-- 09:00-13:00 and 14:00-18:00, leaving a lunch break) instead of exactly
-- one (workflows/custom-time-slots.md, step slot-type-frequency).
--
-- Adds kalendar_custom_time_slots.frequency_ranges: a JSON array of
-- {"start":"HH:MM","end":"HH:MM","frequencyMin":N}. The single-range columns
-- from schema_subset_042.sql (range_start, range_end, frequency_min) are
-- left in place but are no longer read or written (not dropped: this repo's
-- live-DB changes are additive only). They can be removed in a later cleanup.
--
-- The frequency check is replaced so a frequency rule only needs a
-- non-empty frequency_ranges array. Any frequency row created under 042
-- (the feature was brand new) is converted to a one-element array first.
-- Does not touch any other table. Safe to run again.

alter table public.kalendar_custom_time_slots
  add column if not exists frequency_ranges jsonb;

update public.kalendar_custom_time_slots
   set frequency_ranges = jsonb_build_array(
         jsonb_build_object('start', range_start, 'end', range_end, 'frequencyMin', frequency_min)
       )
 where slot_type = 'frequency'
   and frequency_ranges is null
   and range_start is not null
   and range_end is not null
   and frequency_min is not null;

alter table public.kalendar_custom_time_slots
  drop constraint if exists kalendar_custom_time_slots_frequency_check;
alter table public.kalendar_custom_time_slots
  add constraint kalendar_custom_time_slots_frequency_check
  check (
    slot_type = 'custom'
    or (
      frequency_ranges is not null
      and jsonb_typeof(frequency_ranges) = 'array'
      and jsonb_array_length(frequency_ranges) >= 1
    )
  );
