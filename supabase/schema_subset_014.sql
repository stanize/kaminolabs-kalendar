-- ============================================================================
-- schema_subset_014.sql — whatsapp-booking (workflows/whatsapp-booking.md):
-- conversation-flow step's date-list PAGINATION addition (2026-09-22, sixth
-- pass). Adds ONE new column to the existing kalendar_whatsapp_sessions
-- table: date_page, an integer (default 0) tracking which page of open
-- dates the patient is currently viewing in the tappable date list.
--
-- The date list stays a fixed 7-row twilio/list-picker template (no schema
-- change needed for that — same cached date_list_content_sid from
-- schema_subset_013.sql), now showing 6 real dates + a "Ver más fechas" row
-- when more dates exist beyond the current page. date_page persists across
-- messages so a "Ver más fechas" tap advances to the next page on the
-- patient's NEXT message rather than resetting. It is reset to 0 whenever a
-- session (re)enters awaiting_date fresh — from awaiting_service (a new
-- service selection) or from a session reset — never carried across a whole
-- conversation. See lib/whatsapp/conversation.ts / lib/whatsapp/session.ts
-- for the full design.
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes schema_001.sql and schema_subset_002.sql through
-- schema_subset_013.sql have already been run. Touches only
-- kalendar_whatsapp_sessions, additive only (add column if not exists).
--
-- The exact same DDL is ALSO folded into supabase/schema_001.sql.
-- ============================================================================

alter table public.kalendar_whatsapp_sessions
  add column if not exists date_page integer not null default 0;
