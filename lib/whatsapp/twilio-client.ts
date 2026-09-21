import "server-only";
import twilio from "twilio";
import { createClient } from "@/lib/supabase/server";
import { decryptWhatsappSecret } from "@/lib/whatsapp/crypto";

export interface WhatsappConfigRow {
  id: string;
  business_id: string;
  enabled: boolean;
  twilio_account_sid: string | null;
  twilio_auth_token_encrypted: string | null;
  twilio_whatsapp_number: string | null;
  is_sandbox: boolean;
  quick_reply_content_sid: string | null;
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

/**
 * Empty TwiML response — used when the actual reply for this turn was
 * already sent asynchronously via the REST API (client.messages.create),
 * e.g. the native twilio/quick-reply Confirm/Cancel message below. An empty
 * <Response/> tells Twilio "no additional synchronous reply for this
 * inbound message" so the async-sent message isn't duplicated.
 */
export function twimlEmptyReply(): string {
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();
  return twiml.toString();
}

const CONTENT_API_BASE = "https://content.twilio.com/v1/Content";

/**
 * Native WhatsApp interactive messages upgrade (2026-09-21,
 * workflows/whatsapp-booking.md conversation-flow step).
 *
 * SHIPPED: twilio/quick-reply for the Confirm/Cancel step — two static
 * buttons, no per-item dynamic labels needed, so there was nothing here that
 * required guessing at an unverified variable-substitution shape.
 *
 * NOT SHIPPED (re-attempted 2026-09-21, second pass): twilio/list-picker for
 * the service/date/time lists. This pass had one new piece of confirmed
 * evidence going in (a twilio-node GitHub issue example showing
 * `contentVariables: JSON.stringify({ body, button, items })` — i.e. the
 * whole list-picker object re-sent fresh per message, not per-item `{{n}}`
 * substitution the way quick-reply's single `{{1}}` body placeholder works)
 * — but the piece that was still missing, the exact template-CREATION
 * payload, remains genuinely unverified:
 * - Direct doc access is still blocked, and this time confirmed two ways,
 *   not just via the WebFetch tool: `curl` directly to
 *   www.twilio.com/docs/content/twiliolist-picker and to a Postman-hosted
 *   copy of the same page both got `CONNECT tunnel failed, response 403`
 *   from this session's own egress proxy (org policy `connect_rejected`,
 *   not a transient failure — checked via
 *   `curl $HTTPS_PROXY/__agentproxy/status`).
 * - Web search snippets this pass surfaced a *contradiction*, not just a
 *   gap: one snippet attributed to Twilio's own list-picker doc shows
 *   `items` given as real, static values at template-creation time (e.g.
 *   `{"id": "SFO1337", "description": "Owl Air Flight 1337 to LGA"}` baked
 *   into the template, no `{{n}}` placeholder) — which doesn't match the
 *   confirmed dynamic-per-send pattern quoted above at all, if items really
 *   are meant to vary per message (our case) rather than be fixed at
 *   creation. Reconciling those two would be a guess.
 * - More importantly: the GitHub issue this pass was pointed at as
 *   confirmation (twilio/twilio-node#1065, "Supplying Items to a list
 *   template does not work (validation errors)") is itself a live bug
 *   report that the exact per-send items-array approach fails validation
 *   for at least some real users/SDK versions — i.e. even the one shape
 *   that seemed confirmed is independently documented as unreliable in
 *   production, not just unverified.
 * Given real, contradictory, partly-broken evidence rather than just a gap,
 * shipping this untested risks silently breaking the service/date/time
 * steps (the core of the conversation, unlike the one-shot Confirm/Cancel
 * step). Text lists (`twimlReply`, unchanged) are kept for service/date/time
 * selection, both list sizes already capped well under WhatsApp's 10-item
 * list-picker limit (`MAX_DATE_OPTIONS = 7`, `MAX_TIME_OPTIONS = 9` in
 * `lib/whatsapp/conversation.ts`) so no code changes are needed there if/when
 * this is picked up. Revisit once a session has real doc access, or Arun
 * confirms the creation payload from the Twilio console/account directly —
 * test creation + one real send against Twilio sandbox before trusting any
 * shape, given the above.
 */

/** Creates (once) or returns the cached Content API ContentSid for this
 * business's Confirm/Cancel quick-reply template, using the business's own
 * decrypted Twilio credentials. Caches the sid on kalendar_whatsapp_config
 * so it's created at most once per business, not on every message. */
export async function getOrCreateQuickReplyContentSid(
  config: WhatsappConfigRow,
  accountSid: string,
  authToken: string
): Promise<string> {
  if (config.quick_reply_content_sid) return config.quick_reply_content_sid;

  const res = await fetch(CONTENT_API_BASE, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friendly_name: `kalendar_confirm_cancel_${config.business_id}`,
      language: "es",
      types: {
        "twilio/quick-reply": {
          body: "{{1}}",
          actions: [
            { title: "Confirmar", id: "confirm" },
            { title: "Cancelar", id: "cancel" },
          ],
        },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Twilio Content API create failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { sid: string };

  const supabase = await createClient();
  await supabase
    .from("kalendar_whatsapp_config")
    .update({ quick_reply_content_sid: data.sid })
    .eq("id", config.id);

  return data.sid;
}

/** Sends a plain-text WhatsApp message via the REST API (not TwiML) —
 * used alongside sendQuickReplyMessage below so both text and interactive
 * replies for the same conversation go out the same way. */
export async function sendPlainMessage(params: {
  accountSid: string;
  authToken: string;
  from: string; // E.164, no "whatsapp:" prefix
  to: string; // E.164, no "whatsapp:" prefix
  body: string;
}): Promise<void> {
  const client = twilio(params.accountSid, params.authToken);
  await client.messages.create({
    from: `whatsapp:${params.from}`,
    to: `whatsapp:${params.to}`,
    body: params.body,
  });
}

/** Sends the native twilio/quick-reply Confirm/Cancel interactive message
 * via the Content API (contentSid + contentVariables), creating/caching the
 * template on first use. */
export async function sendQuickReplyMessage(params: {
  config: WhatsappConfigRow;
  accountSid: string;
  authToken: string;
  from: string; // E.164, no "whatsapp:" prefix
  to: string; // E.164, no "whatsapp:" prefix
  bodyText: string; // substituted into the template's {{1}} placeholder
}): Promise<void> {
  const contentSid = await getOrCreateQuickReplyContentSid(
    params.config,
    params.accountSid,
    params.authToken
  );

  const client = twilio(params.accountSid, params.authToken);
  await client.messages.create({
    from: `whatsapp:${params.from}`,
    to: `whatsapp:${params.to}`,
    contentSid,
    contentVariables: JSON.stringify({ "1": params.bodyText }),
  });
}
