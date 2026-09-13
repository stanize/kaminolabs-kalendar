-- ============================================================================
-- schema_subset_006.sql — bono-session-deduction moved from app code to a
-- DB trigger (multi-team/scale motivation, 2026-09)
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql (and schema_subset_002.sql through
-- schema_subset_005.sql) have already been run against this database. Does
-- not drop or touch any table's rows — only replaces one function with
-- another and adds a trigger, both idempotent (safe to run twice).
--
-- The exact same function/trigger below is ALSO folded into
-- supabase/schema_001.sql (replacing reverse_bono_session there too) so a
-- full from-scratch rebuild via schema_001.sql still produces the complete,
-- current schema on its own.
--
-- Drops reverse_bono_session — nothing in the app calls it anymore as of
-- this same change (lib/actions/bonos.ts's reverseBonoSessionAction now
-- does a plain update and lets the new trigger handle the session math).
-- Safe: this only removes a function definition, no data is touched.
-- ============================================================================

drop function if exists public.reverse_bono_session(uuid, uuid, text);

create or replace function public.sync_bono_session_usage()
returns trigger language plpgsql as $$
declare
  old_bono_id uuid := null;
  new_bono_id uuid := null;
begin
  if tg_op = 'UPDATE' then
    if old.payment_method = 'bono' then
      old_bono_id := old.bono_purchase_id;
    end if;
  end if;

  if new.payment_method = 'bono' then
    new_bono_id := new.bono_purchase_id;
  end if;

  if old_bono_id is not null and old_bono_id is distinct from new_bono_id then
    update public.kalendar_bono_purchases
    set sessions_used = greatest(sessions_used - 1, 0)
    where id = old_bono_id;
  end if;

  if new_bono_id is not null and new_bono_id is distinct from old_bono_id then
    update public.kalendar_bono_purchases
    set sessions_used = sessions_used + 1
    where id = new_bono_id
      and business_id = new.business_id
      and sessions_used < sessions_total;

    if not found then
      raise exception 'sync_bono_session_usage: bono % not found, wrong business, or already fully used', new_bono_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists kalendar_bookings_sync_bono_session on public.kalendar_bookings;

create trigger kalendar_bookings_sync_bono_session
  after insert or update of payment_method, bono_purchase_id on public.kalendar_bookings
  for each row execute function public.sync_bono_session_usage();
