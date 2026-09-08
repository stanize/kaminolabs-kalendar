-- ============================================================================
-- schema_subset_002.sql — bonos.md (bono-types-schema-and-config +
-- bono-purchase-recording)
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql (and, if applicable, earlier
-- schema_subset_*.sql files) has already been run against this database.
-- This file's own drop-if-exists + create is scoped ONLY to the two new
-- tables below — it does not touch, re-drop, or re-create anything else
-- (kalendar_businesses, kalendar_clients, kalendar_bookings, etc. are left
-- completely alone), so running this against an existing database is safe
-- and does not lose any other data.
--
-- The exact same DDL below is ALSO folded into supabase/schema_001.sql (in
-- its normal place, alongside kalendar_clients) so a full from-scratch
-- rebuild via schema_001.sql still produces the complete schema on its own.
-- This file exists purely so this one increment can be tested/applied on
-- its own, without a full destructive schema_001.sql re-run.
-- ============================================================================

drop table if exists public.kalendar_bono_purchases cascade;
drop table if exists public.kalendar_bono_types      cascade;

-- ----------------------------------------------------------------------------
-- kalendar_bono_types
-- Bonos (session-package workflow, bonos.md) — a clinic's configurable
-- catalog of prepaid session bundles (e.g. "Bono 10 sesiones" for a
-- discounted bundle price). Generic sessions, not tied to one specific
-- service, for MVP — matches bono-types-schema-and-config's explicit
-- scoping. Price is entered directly as the bundle total by the clinic, no
-- assumed discount-% math.
-- ----------------------------------------------------------------------------
create table public.kalendar_bono_types (
  id            uuid        primary key default gen_random_uuid(),
  business_id   uuid        not null references public.kalendar_businesses (id) on delete cascade,
  name          text        not null,
  session_count integer     not null check (session_count > 0),
  price         numeric(10,2) not null check (price >= 0),
  -- Retiring a bono type (no longer sold) without deleting it — deleting
  -- would orphan/cascade-delete any kalendar_bono_purchases that reference
  -- it, destroying real sale history. Inactive types just stop appearing
  -- as an option when recording a new sale.
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

create index kalendar_bono_types_business_id_idx on public.kalendar_bono_types (business_id);

alter table public.kalendar_bono_types enable row level security;

create policy "Bono types: write"
  on public.kalendar_bono_types for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_bono_purchases
-- A specific sold bono, tied to a specific client — bono-purchase-recording.
-- No real payment processing (out of scope by design); this just records
-- that a sale happened. sessions_total/price_paid are SNAPSHOTS taken at
-- purchase time, deliberately independent of kalendar_bono_types' own
-- values changing later — same historical-accuracy pattern as invoices
-- snapshotting amount/service_name at invoice time (pdf-invoicing.md).
-- A client can hold multiple concurrent bonos; nothing here prevents that.
-- ----------------------------------------------------------------------------
create table public.kalendar_bono_purchases (
  id             uuid        primary key default gen_random_uuid(),
  business_id    uuid        not null references public.kalendar_businesses (id) on delete cascade,
  client_id      uuid        not null references public.kalendar_clients (id) on delete cascade,
  bono_type_id   uuid        references public.kalendar_bono_types (id) on delete set null,
  sessions_total integer     not null check (sessions_total > 0),
  sessions_used  integer     not null default 0 check (sessions_used >= 0),
  price_paid     numeric(10,2) not null check (price_paid >= 0),
  purchased_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index kalendar_bono_purchases_business_id_idx on public.kalendar_bono_purchases (business_id);
create index kalendar_bono_purchases_client_id_idx   on public.kalendar_bono_purchases (client_id);

alter table public.kalendar_bono_purchases enable row level security;

create policy "Bono purchases: write"
  on public.kalendar_bono_purchases for all using (true) with check (true);
