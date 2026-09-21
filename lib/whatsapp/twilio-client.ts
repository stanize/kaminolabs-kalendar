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
  service_list_content_sid: string | null;
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
 * SHIPPED (2026-09-21, fourth pass): whatsapp/card with a LIST action for
 * the SERVICE-selection step (`getOrCreateServiceListContentSid` /
 * `sendServiceListMessage` below). The prior two passes' blocker — an
 * unverifiable/contradictory template-creation payload for
 * `twilio/list-picker` — is resolved: Arun supplied a concrete, verified
 * working example from real Twilio reference material. The correct content
 * type is `whatsapp/card` (NOT `twilio/list-picker`, which was the wrong
 * type in prior attempts), with `actions: [{ type: "LIST", ... }]` and the
 * row items given as real static values baked in at template-creation time
 * — which is exactly what the second pass's web-search snippet showed and
 * flagged as a contradiction; it wasn't a contradiction, it was correct, and
 * the "items are per-send/dynamic" GitHub-issue-derived theory from that
 * pass was the wrong track.
 *
 * Because rows are baked in at creation time (not `contentVariables` at
 * send time), a template is tied to one exact set of rows — unlike
 * quick-reply's two fixed buttons, our lists are dynamic content. Services
 * are the one list stable enough to treat like quick-reply (create once per
 * business, cache the sid, reuse): a business's service list doesn't change
 * every conversation the way available dates/times do. So this pass ships
 * the service list only. Recreating the template on every services-edit
 * (staleness detection) is deliberately NOT built this pass — see the
 * schema comment and workflows/whatsapp-booking.md for that known
 * limitation.
 *
 * NOT SHIPPED: date and time lists remain plain-text TwiML
 * (`buildDateOptionsReply`/`buildTimeOptionsReply` in conversation.ts,
 * unchanged). Those lists are genuinely different every conversation
 * (different open dates/times each time), and this Content API shape has no
 * per-send row override — creating a brand-new persistent Content Template
 * via a full HTTP POST on every single message would be a real operational
 * cost (slow, and Twilio accounts have per-account content-template limits)
 * — not a lightweight thing to do once per conversation turn. That's a
 * genuine architecture mismatch with this static-template approach, not a
 * verification gap like the service list's was, so it's being flagged
 * explicitly rather than shipped blind. Revisit only if Twilio's Content API
 * gains a real per-send row-override mechanism, or if the dynamic-content
 * cost/limits trade-off is judged acceptable later.
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

// WhatsApp interactive list message row limits (see doc comment above):
// max 10 rows total across all sections combined, row title max 24 chars,
// row description max 72 chars, list button/menu label max 20 chars.
const LIST_ROW_TITLE_MAX = 24;
const LIST_BUTTON_LABEL_MAX = 20;

/** Row id prefix for service-list rows, so the webhook can recognize and
 * strip it to recover the underlying kalendar_services.id from the
 * inbound `ListId` field without ambiguity against any other row-id shape. */
const SERVICE_LIST_ROW_PREFIX = "svc_";

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/** Creates (once) or returns the cached Content API ContentSid for this
 * business's service-selection whatsapp/card LIST template, using the
 * business's own decrypted Twilio credentials. Caches the sid on
 * kalendar_whatsapp_config so it's created at most once per business, not
 * on every message.
 *
 * KNOWN LIMITATION: rows are baked into the template at creation time, so if
 * `services` changes after the first call (a service renamed/added/removed),
 * the cached template keeps showing the old list until the cache is cleared
 * by hand (e.g. nulling the column) — no staleness detection is built here,
 * deliberately, to keep this pass scoped. See
 * workflows/whatsapp-booking.md's conversation-flow step.
 *
 * KNOWN LIMITATION: a service name longer than LIST_ROW_TITLE_MAX (24 chars)
 * is hard-truncated with an ellipsis rather than solved with any smarter
 * wrapping/shortening logic — acceptable for now, flagged rather than
 * silently broken.
 */
export async function getOrCreateServiceListContentSid(
  config: WhatsappConfigRow,
  accountSid: string,
  authToken: string,
  services: { id: string; name: string; duration_min?: number }[]
): Promise<string> {
  if (config.service_list_content_sid) return config.service_list_content_sid;

  // Content API list-message row cap is 10 total across all sections.
  const rows = services.slice(0, 10).map((s) => ({
    id: `${SERVICE_LIST_ROW_PREFIX}${s.id}`,
    title: truncate(s.name, LIST_ROW_TITLE_MAX),
    ...(s.duration_min ? { description: truncate(`${s.duration_min} min`, 72) } : {}),
  }));

  const res = await fetch(CONTENT_API_BASE, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friendly_name: `kalendar_service_list_${config.business_id}`,
      language: "es",
      types: {
        "whatsapp/card": {
          body: "¡Hola! 👋 ¿Qué servicio te gustaría reservar?",
          actions: [
            {
              type: "LIST",
              title: truncate("Elegir servicio", LIST_BUTTON_LABEL_MAX),
              item: {
                title: "Servicios disponibles",
                subtitle: "Elige una opción",
              },
              sections: [
                {
                  title: "Servicios",
                  rows,
                },
              ],
            },
          ],
        },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Twilio Content API create (service list) failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { sid: string };

  const supabase = await createClient();
  await supabase
    .from("kalendar_whatsapp_config")
    .update({ service_list_content_sid: data.sid })
    .eq("id", config.id);

  return data.sid;
}

/** Sends the native whatsapp/card LIST service-selection message via the
 * Content API, creating/caching the template on first use. Static body —
 * no per-send contentVariables, since the rows are baked into the template
 * (see getOrCreateServiceListContentSid's doc comment for why). */
export async function sendServiceListMessage(params: {
  config: WhatsappConfigRow;
  accountSid: string;
  authToken: string;
  from: string; // E.164, no "whatsapp:" prefix
  to: string; // E.164, no "whatsapp:" prefix
  services: { id: string; name: string; duration_min?: number }[];
}): Promise<void> {
  const contentSid = await getOrCreateServiceListContentSid(
    params.config,
    params.accountSid,
    params.authToken,
    params.services
  );

  const client = twilio(params.accountSid, params.authToken);
  await client.messages.create({
    from: `whatsapp:${params.from}`,
    to: `whatsapp:${params.to}`,
    contentSid,
  });
}

/** Strips the service-list row-id prefix, returning the underlying
 * kalendar_services.id, or null if `listId` isn't a service-list row id
 * (e.g. absent, or a stale/unrelated payload). */
export function parseServiceListId(listId: string | null): string | null {
  if (!listId || !listId.startsWith(SERVICE_LIST_ROW_PREFIX)) return null;
  return listId.slice(SERVICE_LIST_ROW_PREFIX.length);
}
