-- schema_subset_038.sql
-- For workflows/support-ticketing.md: Kalendar Support Framework v1.
-- Adds an attachments column to kalendar_support_ticket_comments so a
-- reply (clinic or admin) can carry pasted image screenshots, same as a
-- ticket's own initial attachments. Does not touch any other table. Safe
-- to run again (add column if not exists).

alter table public.kalendar_support_ticket_comments
  add column if not exists attachments text[] not null default '{}';
