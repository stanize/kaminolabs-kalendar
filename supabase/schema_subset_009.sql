-- ============================================================================
-- schema_subset_009.sql — whatsapp-booking (workflows/whatsapp-booking.md):
-- data-model step. Two new tables: kalendar_whatsapp_config (per-business
-- Twilio credentials) and kalendar_whatsapp_sessions (per business+phone
-- conversation state for the WhatsApp booking bot). (2026-09-21)
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql (and schema_subset_002.sql through
-- schema_subset_008.sql) have already been run against this database. Adds
-- ONLY these two new tables — touches no existing table.
--
-- The exact same DDL is ALSO folded into supabase/schema_001.sql so a full
-- from-scratch rebuild via schema_001.sql still produces the complete,
-- current schema on its own.
--
-- Note on encryption: twilio_auth_token_encrypted stores ciphertext produced
-- and read entirely in application code (lib/whatsapp/crypto.ts, Node
-- AES-256-GCM keyed by the WHATSAPP_CONFIG_ENCRYPTION_KEY env var) —
-- deliberately NOT pgcrypto/pgsodium, so the encryption key never touches
-- the DB layer. This column is just an opaque text column to Postgres.
-- ============================================================================

create table if not exists public.kalendar_whatsapp_config (
  id                          uuid        primary key default gen_random_uuid(),
  business_id                 uuid        not null unique
                                          references public.kalendar_businesses (id) on delete cascade,
  enabled                      boolean     not null default false,
  twilio_account_sid           text,
  twilio_auth_token_encrypted  text,
  twilio_whatsapp_number       text,
  is_sandbox                   boolean     not null default true,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

create index if not exists kalendar_whatsapp_config_business_idx
  on public.kalendar_whatsapp_config (business_id);
create index if not exists kalendar_whatsapp_config_number_idx
  on public.kalendar_whatsapp_config (twilio_whatsapp_number);

alter table public.kalendar_whatsapp_config enable row level security;

drop policy if exists "WhatsappConfig: write" on public.kalendar_whatsapp_config;
create policy "WhatsappConfig: write"
  on public.kalendar_whatsapp_config for all using (true) with check (true);

create table if not exists public.kalendar_whatsapp_sessions (
  id                   uuid        primary key default gen_random_uuid(),
  business_id          uuid        not null references public.kalendar_businesses (id) on delete cascade,
  phone_number         text        not null,
  state                text        not null default 'awaiting_service' check (
    state in (
      'awaiting_service', 'awaiting_date', 'awaiting_time',
      'awaiting_confirmation', 'completed', 'expired'
    )
  ),
  selected_service_id  uuid        references public.kalendar_services (id) on delete set null,
  selected_date        date,
  selected_time        text,
  last_message_at      timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (business_id, phone_number)
);

create index if not exists kalendar_whatsapp_sessions_lookup_idx
  on public.kalendar_whatsapp_sessions (business_id, phone_number);

alter table public.kalendar_whatsapp_sessions enable row level security;

drop policy if exists "WhatsappSessions: write" on public.kalendar_whatsapp_sessions;
create policy "WhatsappSessions: write"
  on public.kalendar_whatsapp_sessions for all using (true) with check (true);
