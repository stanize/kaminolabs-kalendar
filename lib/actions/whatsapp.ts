"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import { encryptWhatsappSecret } from "@/lib/whatsapp/crypto";

// Twilio's own well-known sandbox number — used only to auto-derive the
// read-only is_sandbox indicator (settings-ui step), never to gate anything
// functionally. See workflows/whatsapp-booking.md.
const TWILIO_SANDBOX_NUMBER = "+14155238886";

export interface WhatsappConfigDTO {
  enabled: boolean;
  twilioAccountSid: string;
  // Auth token is never sent back to the client once saved — a masked
  // placeholder only, so the settings form can show "configured" without
  // ever round-tripping the real secret to the browser.
  hasAuthToken: boolean;
  twilioWhatsappNumber: string;
  isSandbox: boolean;
}

/** Reads the current business's WhatsApp config for the settings UI. Never
 * returns the decrypted auth token. */
export const getWhatsappConfig = authedAction(
  async (session): Promise<WhatsappConfigDTO | null> => {
    const business = await getBusinessForUser(session.user.id);
    if (!business) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .from("kalendar_whatsapp_config")
      .select(
        "enabled, twilio_account_sid, twilio_auth_token_encrypted, twilio_whatsapp_number, is_sandbox"
      )
      .eq("business_id", business.id)
      .maybeSingle();

    if (!data) return null;

    return {
      enabled: data.enabled,
      twilioAccountSid: data.twilio_account_sid ?? "",
      hasAuthToken: !!data.twilio_auth_token_encrypted,
      twilioWhatsappNumber: data.twilio_whatsapp_number ?? "",
      isSandbox: data.is_sandbox,
    };
  }
);

export interface SaveWhatsappConfigInput {
  enabled: boolean;
  twilioAccountSid: string;
  // Empty string means "leave the existing encrypted token untouched" — the
  // form never pre-fills the real value, so an unedited field must not wipe
  // out a previously-saved token.
  twilioAuthToken: string;
  twilioWhatsappNumber: string;
}

export type SaveWhatsappConfigResult =
  | { ok: true }
  | { ok: false; error: string };

/** Saves (upserts) the current business's WhatsApp config. Encrypts the auth
 * token before it ever reaches the DB; never logs or echoes it back. */
export const saveWhatsappConfig = authedAction(
  async (
    session,
    input: SaveWhatsappConfigInput,
    dict?: { errBusinessRequired?: string; errSaveFailed?: string }
  ): Promise<SaveWhatsappConfigResult> => {
    const business = await getBusinessForUser(session.user.id);
    if (!business) {
      return {
        ok: false,
        error: dict?.errBusinessRequired ?? "Completa primero los datos de tu negocio.",
      };
    }

    const accountSid = input.twilioAccountSid.trim();
    const number = input.twilioWhatsappNumber.trim();
    const isSandbox = number === TWILIO_SANDBOX_NUMBER;

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("kalendar_whatsapp_config")
      .select("id, twilio_auth_token_encrypted")
      .eq("business_id", business.id)
      .maybeSingle();

    const authTokenEncrypted = input.twilioAuthToken.trim()
      ? encryptWhatsappSecret(input.twilioAuthToken.trim())
      : (existing?.twilio_auth_token_encrypted ?? null);

    const { error } = await supabase.from("kalendar_whatsapp_config").upsert(
      {
        business_id: business.id,
        enabled: input.enabled,
        twilio_account_sid: accountSid || null,
        twilio_auth_token_encrypted: authTokenEncrypted,
        twilio_whatsapp_number: number || null,
        is_sandbox: isSandbox,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    );

    if (error) {
      return { ok: false, error: dict?.errSaveFailed ?? "No se pudo guardar la configuración." };
    }

    revalidatePath("/panel/business");
    return { ok: true };
  }
);
