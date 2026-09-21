-- ============================================================================
-- schema_subset_013.sql — whatsapp-booking (workflows/whatsapp-booking.md):
-- conversation-flow step's date/time list-picker upgrade (2026-09-22, fifth
-- pass). Adds TWO new columns to the existing kalendar_whatsapp_config
-- table: date_list_content_sid and time_list_content_sid, caching the
-- Twilio Content API ContentSid (HXxxxx) for the per-business whatsapp/card
-- LIST date-selection and time-selection templates.
--
-- Unlike the service list (schema_subset_011.sql), these templates use
-- NUMBERED PLACEHOLDERS ({{1}}, {{2}}, ... {{n}}) for the body text and
-- every row's id/title/description, so the same static template can be
-- reused for genuinely-different-every-conversation date/time options —
-- real values are injected per-send via contentVariables, not baked in at
-- creation time. Each template is still created lazily on first use under
-- that business's own Twilio account and cached here (never recreated per
-- message). See lib/whatsapp/twilio-client.ts's doc comment for the full
-- design, including the row-count sizing (7 date rows / 9 time rows,
-- matching conversation.ts's MAX_DATE_OPTIONS/MAX_TIME_OPTIONS) and the
-- fewer-than-max-rows filler-row approach.
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes schema_001.sql and schema_subset_002.sql through
-- schema_subset_012.sql (if present) have already been run. Touches only
-- kalendar_whatsapp_config, additive only (add column if not exists).
--
-- The exact same DDL is ALSO folded into supabase/schema_001.sql.
-- ============================================================================

alter table public.kalendar_whatsapp_config
  add column if not exists date_list_content_sid text;

alter table public.kalendar_whatsapp_config
  add column if not exists time_list_content_sid text;
