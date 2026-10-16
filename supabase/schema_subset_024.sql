-- schema_subset_024.sql
-- next-invoice-number-override (pdf-invoicing.md) — lets a clinic set the
-- number their NEXT generated invoice should get, for when they switch to
-- Kalendar mid-year and need to continue their existing sequence instead
-- of restarting at 0001.
--
-- Touches only kalendar_businesses (new column) and replaces the existing
-- allocate_invoice_number function (schema_subset_023.sql) — no other
-- table is affected. Safe to run again.

alter table public.kalendar_businesses
  add column if not exists invoice_next_number int;

create or replace function public.allocate_invoice_number(p_business_id uuid, p_issue_year int)
returns text language plpgsql as $$
declare
  v_next int;
  v_override int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':' || p_issue_year::text, 0));

  select coalesce(max(invoice_number::int), 0) + 1
    into v_next
    from public.kalendar_invoices
    where business_id = p_business_id
      and issue_year = p_issue_year;

  -- Only raises v_next, never lowers it below a number already issued
  -- this year, and is consumed (cleared) the moment it's applied so it
  -- only affects the very next invoice.
  select invoice_next_number into v_override
    from public.kalendar_businesses
    where id = p_business_id;

  if v_override is not null then
    if v_override > v_next then
      v_next := v_override;
    end if;
    update public.kalendar_businesses set invoice_next_number = null where id = p_business_id;
  end if;

  return lpad(v_next::text, 4, '0');
end;
$$;
