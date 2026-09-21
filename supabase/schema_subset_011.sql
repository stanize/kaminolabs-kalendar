-- ============================================================================
-- schema_subset_011.sql — whatsapp-booking (workflows/whatsapp-booking.md):
-- conversation-flow step's list-picker (service list) upgrade (2026-09-21,
-- third pass — supersedes the "NOT SHIPPED" note from the prior two passes
-- for the service-selection step only). Adds ONE new column to the existing
-- kalendar_whatsapp_config table: service_list_content_sid, caching the
-- Twilio Content API ContentSid (HXxxxx) for the per-business whatsapp/card
-- LIST service-selection template, created lazily on first use under that
-- business's own Twilio account and reused afterwards (never recreated on
-- every message, and NOT recreated automatically if the business's services
-- change later — see the workflow doc for that known limitation).
--
-- No date/time list content sid column — date/time selection remains
-- plain-text TwiML in this pass, since those lists are genuinely different
-- every conversation and this static-template approach doesn't fit them
-- without creating a fresh Content Template per message (see the workflow
-- doc for the full reasoning).
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes schema_001.sql and schema_subset_002.sql through
-- schema_subset_010.sql have already been run. Touches only
-- kalendar_whatsapp_config, additive only (add column if not exists).
--
-- The exact same DDL is ALSO folded into supabase/schema_001.sql.
-- ============================================================================

alter table public.kalendar_whatsapp_config
  add column if not exists service_list_content_sid text;
