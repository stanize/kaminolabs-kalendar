-- ============================================================================
-- schema_subset_004.sql — bonos.md (bono-session-reversal)
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql (and schema_subset_002.sql,
-- schema_subset_003.sql) have already been run against this database.
-- This file only creates a function — no tables/columns touched, no data
-- at risk either way.
--
-- The exact same function below is ALSO folded into supabase/schema_001.sql
-- so a full from-scratch rebuild via schema_001.sql still produces the
-- complete schema on its own.
-- ============================================================================

create or replace function public.reverse_bono_session(
  p_booking_id uuid,
  p_business_id uuid,
  p_new_payment_method text
)
returns void
language plpgsql
as $$
declare
  v_bono_id uuid;
begin
  if p_new_payment_method not in ('cash', 'card') then
    raise exception 'reverse_bono_session: p_new_payment_method must be cash or card';
  end if;

  select bono_purchase_id into v_bono_id
  from public.kalendar_bookings
  where id = p_booking_id
    and business_id = p_business_id
    and payment_method = 'bono'
    and bono_purchase_id is not null;

  if v_bono_id is null then
    raise exception 'reverse_bono_session: booking not found, not bono-paid, or business mismatch';
  end if;

  update public.kalendar_bono_purchases
  set sessions_used = greatest(sessions_used - 1, 0)
  where id = v_bono_id
    and business_id = p_business_id;

  update public.kalendar_bookings
  set payment_method = p_new_payment_method,
      bono_purchase_id = null
  where id = p_booking_id
    and business_id = p_business_id;
end;
$$;
