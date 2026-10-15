-- ============================================================================
-- schema_subset_023.sql — invoicing (pdf-invoicing.md): kalendar_invoices,
-- new kalendar_businesses columns, sequential numbering function.
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql and every earlier schema_subset_*.sql
-- have already run against this database. Purely additive — a brand new
-- table plus new nullable/defaulted columns on kalendar_businesses, no
-- existing data touched. Safe to re-run.
-- ============================================================================

alter table public.kalendar_businesses
  add column if not exists invoice_template_id text not null default 'vat-exempt';
alter table public.kalendar_businesses
  add column if not exists professional_dni text;
alter table public.kalendar_businesses
  add column if not exists professional_college_number text;
alter table public.kalendar_businesses
  add column if not exists signature_url text;
alter table public.kalendar_businesses
  add column if not exists auto_invoice_enabled boolean not null default false;

create table if not exists public.kalendar_invoices (
  id              uuid        primary key default gen_random_uuid(),
  business_id     uuid        not null references public.kalendar_businesses (id) on delete cascade,
  booking_id      uuid        references public.kalendar_bookings (id) on delete set null,
  invoice_number  text        not null,
  issue_year      integer     not null,
  client_name     text        not null,
  client_email    text        not null,
  service_name    text        not null,
  payment_method  text        check (payment_method in ('cash', 'card', 'bono')),
  amount          numeric(10, 2) not null default 0 check (amount >= 0),
  access_token    text        not null unique,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

create unique index if not exists kalendar_invoices_number_idx
  on public.kalendar_invoices (business_id, issue_year, invoice_number);
create index if not exists kalendar_invoices_business_id_idx on public.kalendar_invoices (business_id);
create index if not exists kalendar_invoices_booking_id_idx  on public.kalendar_invoices (booking_id) where booking_id is not null;
create index if not exists kalendar_invoices_access_token_idx on public.kalendar_invoices (access_token);

alter table public.kalendar_invoices enable row level security;

create or replace function public.allocate_invoice_number(p_business_id uuid, p_issue_year int)
returns text language plpgsql as $$
declare
  v_next int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':' || p_issue_year::text, 0));

  select coalesce(max(invoice_number::int), 0) + 1
    into v_next
    from public.kalendar_invoices
    where business_id = p_business_id
      and issue_year = p_issue_year;

  return lpad(v_next::text, 4, '0');
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoice-signatures',
  'invoice-signatures',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp']
) on conflict (id) do nothing;
