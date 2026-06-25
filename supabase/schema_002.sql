-- ============================================================================
-- Migration 002 — Support tickets
-- Applied: manually via Supabase SQL editor
-- Depends on: schema_001.sql (base schema)
-- ============================================================================
-- Creates:
--   - support_ticket_status enum
--   - support_ticket_category enum
--   - kalendar_support_tickets table
--   - indexes on user_id and status
--   - set_updated_at() trigger function
--   - updated_at trigger on kalendar_support_tickets
--   - RLS policies (public read + insert, service role bypasses via server actions)
--
-- Storage bucket (run separately in Supabase dashboard → Storage, or via SQL below):
--   Bucket name : support-attachments
--   Public      : true
--   Max size    : 5 MB
--   MIME types  : image/png, image/jpeg, image/webp, image/gif
-- ============================================================================

create type public.support_ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.support_ticket_category as enum ('billing', 'technical', 'feature_request', 'account', 'other');

create table public.kalendar_support_tickets (
  id           uuid                           primary key default gen_random_uuid(),
  user_id      text                           not null,
  user_email   text                           not null default '',
  subject      text                           not null,
  description  text                           not null,
  category     public.support_ticket_category not null default 'other',
  status       public.support_ticket_status   not null default 'open',
  attachments  text[]                         not null default '{}',
  -- Populated by the help-portal admin when responding to a ticket
  admin_notes  text,
  created_at   timestamptz                    not null default now(),
  updated_at   timestamptz                    not null default now()
);

create index kalendar_support_tickets_user_id_idx on public.kalendar_support_tickets (user_id);
create index kalendar_support_tickets_status_idx  on public.kalendar_support_tickets (status);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger kalendar_support_tickets_updated_at
  before update on public.kalendar_support_tickets
  for each row execute function public.set_updated_at();

alter table public.kalendar_support_tickets enable row level security;

create policy "Support: owner read"
  on public.kalendar_support_tickets for select
  using (true);

create policy "Support: owner insert"
  on public.kalendar_support_tickets for insert
  with check (true);

-- Optional: create the storage bucket via SQL instead of the dashboard
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values (
--   'support-attachments',
--   'support-attachments',
--   true,
--   5242880,
--   array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
-- ) on conflict (id) do nothing;

-- ============================================================================
-- End of migration 002.
-- ============================================================================
