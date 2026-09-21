-- ============================================================================
-- schema_subset_010.sql — whatsapp-booking (workflows/whatsapp-booking.md):
-- conversation-flow step's native-interactive-messages upgrade (2026-09-21).
-- Adds ONE new column to the existing kalendar_whatsapp_config table:
-- quick_reply_content_sid, caching the Twilio Content API ContentSid (HXxxxx)
-- for the per-business Confirm/Cancel twilio/quick-reply template, created
-- lazily on first use under that business's own Twilio account and reused
-- afterwards (never recreated on every message).
--
-- No list-picker content sid column — see workflows/whatsapp-booking.md for
-- why the list-picker (service/date/time) part of this upgrade was NOT
-- shipped and still falls back to plain-text TwiML.
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes schema_001.sql and schema_subset_002.sql through
-- schema_subset_009.sql have already been run. Touches only
-- kalendar_whatsapp_config, additive only (add column if not exists).
--
-- The exact same DDL is ALSO folded into supabase/schema_001.sql.
-- ============================================================================

alter table public.kalendar_whatsapp_config
  add column if not exists quick_reply_content_sid text;
