-- schema_subset_029.sql
-- invoice-concepts-list (pdf-invoicing.md) — a per-business, clinic-managed
-- list of billing line-item descriptions picked at invoice-generation time
-- instead of always reusing the booking's service_name verbatim. Managed
-- from Settings > Facturación; typing a new one in the invoice confirm
-- modal auto-adds it here too. Blank slate by design — no starter list
-- seeded for any business.
--
-- New table only. Safe to run again.

create table if not exists public.kalendar_invoice_concepts (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references public.kalendar_businesses (id) on delete cascade,
  label       text        not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists kalendar_invoice_concepts_business_label_idx
  on public.kalendar_invoice_concepts (business_id, lower(label));
create index if not exists kalendar_invoice_concepts_business_id_idx
  on public.kalendar_invoice_concepts (business_id);

alter table public.kalendar_invoice_concepts enable row level security;
