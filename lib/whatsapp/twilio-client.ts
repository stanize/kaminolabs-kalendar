import "server-only";
import twilio from "twilio";
import { decryptWhatsappSecret } from "@/lib/whatsapp/crypto";

export interface WhatsappConfigRow {
  id: string;
  business_id: string;
  enabled: boolean;
  twilio_account_sid: string | null;
  twilio_auth_token_encrypted: string | null;
  twilio_whatsapp_number: string | null;
  is_sandbox: boolean;
}

/** Decrypts a config row's Twilio auth token. Throws if the row has none. */
export function decryptConfigAuthToken(config: WhatsappConfigRow): string {
  if (!config.twilio_auth_token_encrypted) {
    throw new Error(`WhatsApp config for business ${config.business_id} has no auth token set.`);
  }
  return decryptWhatsappSecret(config.twilio_auth_token_encrypted);
}

/**
 * Validates Twilio's X-Twilio-Signature header for an inbound webhook
 * request, using the resolved business's OWN decrypted auth token as the
 * signing secret (per-clinic Twilio accounts — see
 * workflows/whatsapp-booking.md's webhook-routing step).
 *
 * `url` must be the exact, fully-qualified webhook URL Twilio was configured
 * with (including https://) — Twilio's signature covers the URL + sorted
 * form params, so any mismatch (trailing slash, host, protocol) fails
 * validation even for a legitimate request.
 */
export function validateTwilioSignature(params: {
  authToken: string;
  signature: string | null;
  url: string;
  body: Record<string, string>;
}): boolean {
  if (!params.signature) return false;
  return twilio.validateRequest(params.authToken, params.signature, params.url, params.body);
}

/**
 * Builds a TwiML <Response><Message>...</Message></Response> reply.
 *
 * DELIBERATE CHOICE: replies are synchronous plain-text TwiML, not Twilio's
 * async REST API (`client.messages.create`) with WhatsApp interactive
 * list/button content templates. The conversation only ever needs numbered
 * plain-text options (per workflows/whatsapp-booking.md's "list/button taps
 * only, no free-text NLP" — here a numbered-list tap is simulated as the
 * patient typing the option's number), and TwiML lets the whole
 * request/response conversation turn complete in one HTTP round trip with no
 * separate outbound API call or its own auth.
 *
 * TODO (flagged per this feature's build instructions, not guessed at): a
 * real native interactive WhatsApp list/button message (via Twilio's
 * Content API / `contentSid` + `contentVariables` on `client.messages.create`)
 * would be a nicer UX than numbered plain text, but the exact current
 * Twilio Node SDK method shapes and content-template setup for WhatsApp
 * interactive messages are NOT confidently known here — getting that payload
 * wrong is worse than shipping plain text that reliably works. Revisit with
 * real Twilio sandbox/account testing before attempting it.
 */
export function twimlReply(message: string): string {
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();
  twiml.message(message);
  return twiml.toString();
}
