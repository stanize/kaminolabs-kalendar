-- schema_subset_044.sql
-- pdf-invoicing.md, steps invoice-edit-before-generate and invoice-regenerate.
--
-- 1) kalendar_invoices gains:
--    - note             free text printed on the invoice ("Observaciones"),
--                       entered in the generate-invoice panel
--    - original_amount  the appointment's service price at generation time,
--                       set only when the clinic changed the amount
--    - amount_modified  true when amount differs from the service price.
--                       An internal marker: NOT printed on the PDF, shown on
--                       the Facturas page
--    - version          1 for a first issue; +1 on every "Regenerar"
--    - regenerated_at   when the current version was generated (null for v1)
-- 2) kalendar_invoice_versions keeps every SUPERSEDED version of an invoice
--    (same invoice number, older content), so the clinic has a history. The
--    invoice row itself is always the current version.
--
-- Additive only: no existing column or table is changed or dropped. Existing
-- invoices become version 1. Safe to run again.

alter table public.kalendar_invoices
  add column if not exists note            text,
  add column if not exists original_amount numeric(10, 2),
  add column if not exists amount_modified boolean     not null default false,
  add column if not exists version         integer     not null default 1,
  add column if not exists regenerated_at  timestamptz;

create table if not exists public.kalendar_invoice_versions (
  id               uuid        primary key default gen_random_uuid(),
  invoice_id       uuid        not null references public.kalendar_invoices (id) on delete cascade,
  business_id      uuid        not null references public.kalendar_businesses (id) on delete cascade,
  version          integer     not null,
  client_name      text        not null,
  client_email     text        not null,
  client_dni       text        not null default '',
  client_address   text        not null default '',
  service_name     text        not null,
  payment_method   text,
  amount           numeric(10, 2) not null default 0,
  original_amount  numeric(10, 2),
  amount_modified  boolean     not null default false,
  note             text,
  business_snapshot jsonb      not null default '{}'::jsonb,
  verification_url text,
  -- when this version was generated (the invoice's created_at for v1, its
  -- regenerated_at for a later one), not when it was archived here.
  issued_at        timestamptz not null,
  created_at       timestamptz not null default now(),
  unique (invoice_id, version)
);

create index if not exists kalendar_invoice_versions_invoice_id_idx
  on public.kalendar_invoice_versions (invoice_id);
create index if not exists kalendar_invoice_versions_business_id_idx
  on public.kalendar_invoice_versions (business_id);

alter table public.kalendar_invoice_versions enable row level security;
