import "server-only";
import { createClient } from "@/lib/supabase/server";

export type WhatsappSessionState =
  | "awaiting_service"
  | "awaiting_date"
  | "awaiting_time"
  | "awaiting_confirmation"
  | "completed"
  | "expired";

export interface WhatsappSessionRow {
  id: string;
  business_id: string;
  phone_number: string;
  state: WhatsappSessionState;
  selected_service_id: string | null;
  selected_date: string | null; // "YYYY-MM-DD"
  selected_time: string | null; // "HH:MM"
  last_message_at: string;
}

// 30 minutes of inactivity before a new inbound message starts a fresh
// conversation instead of resuming a stale one — see
// workflows/whatsapp-booking.md's conversation-flow step.
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Loads the session for (business, phone), resetting it to a fresh
 * awaiting_service state if none exists or the existing one has gone stale
 * (per SESSION_TIMEOUT_MS). Always returns a usable, current row.
 */
export async function loadOrResetSession(
  businessId: string,
  phoneNumber: string
): Promise<WhatsappSessionRow> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("kalendar_whatsapp_sessions")
    .select("*")
    .eq("business_id", businessId)
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  const isStale =
    existing &&
    Date.now() - new Date(existing.last_message_at).getTime() > SESSION_TIMEOUT_MS;

  if (!existing || isStale || existing.state === "completed" || existing.state === "expired") {
    return resetSession(businessId, phoneNumber);
  }

  return existing as WhatsappSessionRow;
}

/** Resets (or creates) the session back to a fresh awaiting_service state. */
export async function resetSession(
  businessId: string,
  phoneNumber: string
): Promise<WhatsappSessionRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kalendar_whatsapp_sessions")
    .upsert(
      {
        business_id: businessId,
        phone_number: phoneNumber,
        state: "awaiting_service",
        selected_service_id: null,
        selected_date: null,
        selected_time: null,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,phone_number" }
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to reset WhatsApp session: ${error?.message}`);
  }
  return data as WhatsappSessionRow;
}

/** Patches specific fields on an existing session row and bumps last_message_at. */
export async function updateSession(
  id: string,
  patch: Partial<
    Pick<
      WhatsappSessionRow,
      "state" | "selected_service_id" | "selected_date" | "selected_time"
    >
  >
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("kalendar_whatsapp_sessions")
    .update({ ...patch, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
}
