-- schema_subset_037.sql
-- For workflows/support-ticketing.md: Kalendar Support Framework v1.
-- Adds reported_via/created_by_admin_email to kalendar_support_tickets,
-- drops the never-used admin_notes column, and adds the new two-way
-- comment thread table. Does not touch any other table. Safe to run
-- again (add column if not exists / create if not exists / drop if exists).

do $$ begin
  create type public.support_ticket_source as enum ('panel', 'whatsapp', 'email', 'phone', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.support_comment_author_type as enum ('clinic', 'admin');
exception when duplicate_object then null; end $$;

alter table public.kalendar_support_tickets
  add column if not exists reported_via public.support_ticket_source not null default 'panel',
  add column if not exists created_by_admin_email text;

alter table public.kalendar_support_tickets
  drop column if exists admin_notes;

create table if not exists public.kalendar_support_ticket_comments (
  id           uuid        primary key default gen_random_uuid(),
  ticket_id    uuid        not null references public.kalendar_support_tickets (id) on delete cascade,
  author_type  public.support_comment_author_type not null,
  author_name  text,
  author_email text        not null,
  body         text        not null,
  created_at   timestamptz not null default now()
);

create index if not exists kalendar_support_ticket_comments_ticket_id_idx
  on public.kalendar_support_ticket_comments (ticket_id);

alter table public.kalendar_support_ticket_comments enable row level security;

drop policy if exists "Support comments: read" on public.kalendar_support_ticket_comments;
create policy "Support comments: read"
  on public.kalendar_support_ticket_comments for select using (true);

drop policy if exists "Support comments: insert" on public.kalendar_support_ticket_comments;
create policy "Support comments: insert"
  on public.kalendar_support_ticket_comments for insert with check (true);
