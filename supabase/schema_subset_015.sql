-- ============================================================================
-- schema_subset_015.sql — whatsapp-booking (workflows/whatsapp-booking.md):
-- conversation-flow step's PROFILE-NAME CAPTURE addition (2026-09-22).
-- Adds ONE new column to the existing kalendar_whatsapp_sessions table:
-- profile_name, a nullable text column storing the WhatsApp sender's
-- self-set display name (Twilio's inbound "ProfileName" form field).
--
-- Not present on every inbound message, so it is captured opportunistically
-- — set whenever a message carries a non-empty ProfileName, and never
-- overwritten by a later message that lacks one, so the best name seen
-- across the whole conversation is kept. Used at the awaiting_confirmation
-- step as the booking's clientName in place of the "WhatsApp <phone>"
-- placeholder, when present. See lib/whatsapp/conversation.ts /
-- lib/whatsapp/session.ts for the full design.
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes schema_001.sql and schema_subset_002.sql through
-- schema_subset_014.sql have already been run. Touches only
-- kalendar_whatsapp_sessions, additive only (add column if not exists).
--
-- The exact same DDL is ALSO folded into supabase/schema_001.sql.
-- ============================================================================

alter table public.kalendar_whatsapp_sessions
  add column if not exists profile_name text;
