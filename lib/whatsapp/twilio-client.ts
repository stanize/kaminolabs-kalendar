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
  date_list_content_sid: string | null;
  time_list_content_sid: string | null;
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

  // Content API list-message row cap is 10 total.
  const items = services.slice(0, 10).map((s) => ({
    id: `${SERVICE_LIST_ROW_PREFIX}${s.id}`,
    item: truncate(s.name, LIST_ROW_TITLE_MAX),
    ...(s.duration_min ? { description: truncate(`${s.duration_min} min`, 72) } : {}),
  }));

  const res = await fetch(CONTENT_API_BASE, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friendly_name: `kalendar_service_list_v2_${config.business_id}`,
      language: "es",
      types: {
        "twilio/list-picker": {
          body: "¡Hola! 👋 ¿Qué servicio te gustaría reservar?",
          button: truncate("Elegir servicio", LIST_BUTTON_LABEL_MAX),
          items,
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

/**
 * DATE and TIME list-picker upgrade (2026-09-22, fifth pass,
 * workflows/whatsapp-booking.md conversation-flow step).
 *
 * Unlike the service list above, date/time options are genuinely different
 * every conversation, so this cannot reuse the "bake rows in at creation
 * time" approach. Arun supplied a concrete working example showing the
 * correct shape for genuinely dynamic content: a template with NUMBERED
 * PLACEHOLDERS (`{{1}}`, `{{2}}`, ... `{{n}}`) for the body text AND every
 * row's id/title/description, created ONCE per business (static, reusable,
 * exactly like the service-list/quick-reply templates), with real values
 * injected via `contentVariables` on every single send — never a new
 * template per message.
 *
 * Row-count design: the template's placeholder count is fixed at creation
 * time, so it must be sized to the conversation's actual maximum
 * (`MAX_DATE_OPTIONS` / `MAX_TIME_OPTIONS` in conversation.ts — 7 and 9
 * respectively, already respecting WhatsApp's 10-row cap). These constants
 * are duplicated here (DATE_LIST_MAX_ROWS / TIME_LIST_MAX_ROWS) rather than
 * imported, to avoid a circular import (conversation.ts already imports
 * parseServiceListId from this file) — keep the two pairs of constants in
 * sync if either changes.
 *
 * FEWER-THAN-MAX ROWS: when a real send has fewer options than the
 * template's max (e.g. only 3 open slots that day out of a 9-row time
 * template), the unused row slots are filled with a non-matching sentinel
 * id (`date_unused_<n>` / `time_unused_<n>`, which parseDateListId /
 * parseTimeListId strip to a value that never matches a real option, so a
 * tap on one is treated as invalid input and re-prompts, same as any other
 * unrecognized reply) and a literal filler title ("(no disponible)"). This
 * is NOT verified live — flagged as a known limitation below and in the
 * workflow doc rather than assumed safe: an empty-string id/title was
 * considered but risks either a blank-looking row or a template-creation
 * validation error (row title has a minimum length in WhatsApp's schema),
 * so a real, visible-but-inert filler row was judged the safer default for
 * an unverified case. Revisit once this is actually exercised live.
 */

// Row-count constants — MUST stay in sync with conversation.ts's
// MAX_DATE_OPTIONS / MAX_TIME_OPTIONS (see doc comment above for why they're
// not imported directly).
const DATE_LIST_MAX_ROWS = 7;
const TIME_LIST_MAX_ROWS = 9;

const DATE_LIST_ROW_PREFIX = "date_";
const TIME_LIST_ROW_PREFIX = "time_";
const LIST_ROW_FILLER_TITLE = "(no disponible)";

function buildRowPlaceholders(startIndex: number, count: number) {
  const rows: { id: string; item: string; description: string }[] = [];
  let idx = startIndex;
  for (let i = 0; i < count; i++) {
    rows.push({ id: `{{${idx}}}`, item: `{{${idx + 1}}}`, description: `{{${idx + 2}}}` });
    idx += 3;
  }
  return rows;
}

/** Creates (once) or returns the cached Content API ContentSid for this
 * business's date-selection whatsapp/card LIST template (numbered
 * placeholders, values injected per-send via contentVariables — see the doc
 * comment above). Caches on kalendar_whatsapp_config.date_list_content_sid. */
export async function getOrCreateDateListContentSid(
  config: WhatsappConfigRow,
  accountSid: string,
  authToken: string
): Promise<string> {
  if (config.date_list_content_sid) return config.date_list_content_sid;

  const rows = buildRowPlaceholders(2, DATE_LIST_MAX_ROWS);

  const res = await fetch(CONTENT_API_BASE, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friendly_name: `kalendar_date_list_v2_${config.business_id}`,
      language: "es",
      types: {
        "twilio/list-picker": {
          body: "Servicio: *{{1}}*\n\n¿Qué día prefieres? Elige una opción:",
          button: truncate("Elegir fecha", LIST_BUTTON_LABEL_MAX),
          items: rows,
        },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Twilio Content API create (date list) failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { sid: string };

  const supabase = await createClient();
  await supabase
    .from("kalendar_whatsapp_config")
    .update({ date_list_content_sid: data.sid })
    .eq("id", config.id);

  return data.sid;
}

/** Creates (once) or returns the cached Content API ContentSid for this
 * business's time-selection whatsapp/card LIST template. Caches on
 * kalendar_whatsapp_config.time_list_content_sid. */
export async function getOrCreateTimeListContentSid(
  config: WhatsappConfigRow,
  accountSid: string,
  authToken: string
): Promise<string> {
  if (config.time_list_content_sid) return config.time_list_content_sid;

  const rows = buildRowPlaceholders(2, TIME_LIST_MAX_ROWS);

  const res = await fetch(CONTENT_API_BASE, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friendly_name: `kalendar_time_list_v2_${config.business_id}`,
      language: "es",
      types: {
        "twilio/list-picker": {
          body: "Fecha: *{{1}}*\n\n¿A qué hora prefieres? Elige una opción:",
          button: truncate("Elegir hora", LIST_BUTTON_LABEL_MAX),
          items: rows,
        },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Twilio Content API create (time list) failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { sid: string };

  const supabase = await createClient();
  await supabase
    .from("kalendar_whatsapp_config")
    .update({ time_list_content_sid: data.sid })
    .eq("id", config.id);

  return data.sid;
}

/** Sends the native whatsapp/card LIST date-selection message via the
 * Content API — creates/caches the (static, placeholder-only) template on
 * first use, then injects the real service name + date rows for this send
 * via contentVariables. Unused row slots (fewer real dates than
 * DATE_LIST_MAX_ROWS) are filled with an inert sentinel row — see the doc
 * comment above. */
export async function sendDateListMessage(params: {
  config: WhatsappConfigRow;
  accountSid: string;
  authToken: string;
  from: string; // E.164, no "whatsapp:" prefix
  to: string; // E.164, no "whatsapp:" prefix
  serviceName: string;
  dates: { id: string; label: string }[]; // id = raw "YYYY-MM-DD", unprefixed
}): Promise<void> {
  const contentSid = await getOrCreateDateListContentSid(params.config, params.accountSid, params.authToken);

  const variables: Record<string, string> = { "1": truncate(params.serviceName, 200) };
  let idx = 2;
  for (let i = 0; i < DATE_LIST_MAX_ROWS; i++) {
    const d = params.dates[i];
    if (d) {
      variables[String(idx)] = `${DATE_LIST_ROW_PREFIX}${d.id}`;
      variables[String(idx + 1)] = truncate(d.label, LIST_ROW_TITLE_MAX);
      variables[String(idx + 2)] = "";
    } else {
      variables[String(idx)] = `${DATE_LIST_ROW_PREFIX}unused_${i}`;
      variables[String(idx + 1)] = LIST_ROW_FILLER_TITLE;
      variables[String(idx + 2)] = "";
    }
    idx += 3;
  }

  const client = twilio(params.accountSid, params.authToken);
  await client.messages.create({
    from: `whatsapp:${params.from}`,
    to: `whatsapp:${params.to}`,
    contentSid,
    contentVariables: JSON.stringify(variables),
  });
}

/** Sends the native whatsapp/card LIST time-selection message via the
 * Content API — same pattern as sendDateListMessage above, for times. */
export async function sendTimeListMessage(params: {
  config: WhatsappConfigRow;
  accountSid: string;
  authToken: string;
  from: string; // E.164, no "whatsapp:" prefix
  to: string; // E.164, no "whatsapp:" prefix
  dateLabel: string;
  slots: { id: string; label: string }[]; // id = slot's startIso, unprefixed
}): Promise<void> {
  const contentSid = await getOrCreateTimeListContentSid(params.config, params.accountSid, params.authToken);

  const variables: Record<string, string> = { "1": truncate(params.dateLabel, 200) };
  let idx = 2;
  for (let i = 0; i < TIME_LIST_MAX_ROWS; i++) {
    const s = params.slots[i];
    if (s) {
      variables[String(idx)] = `${TIME_LIST_ROW_PREFIX}${s.id}`;
      variables[String(idx + 1)] = truncate(s.label, LIST_ROW_TITLE_MAX);
      variables[String(idx + 2)] = "";
    } else {
      variables[String(idx)] = `${TIME_LIST_ROW_PREFIX}unused_${i}`;
      variables[String(idx + 1)] = LIST_ROW_FILLER_TITLE;
      variables[String(idx + 2)] = "";
    }
    idx += 3;
  }

  const client = twilio(params.accountSid, params.authToken);
  await client.messages.create({
    from: `whatsapp:${params.from}`,
    to: `whatsapp:${params.to}`,
    contentSid,
    contentVariables: JSON.stringify(variables),
  });
}

/** Strips the date-list row-id prefix, returning the underlying raw
 * "YYYY-MM-DD" date string, or null if `listId` isn't a date-list row id. */
export function parseDateListId(listId: string | null): string | null {
  if (!listId || !listId.startsWith(DATE_LIST_ROW_PREFIX)) return null;
  return listId.slice(DATE_LIST_ROW_PREFIX.length);
}

/** Strips the time-list row-id prefix, returning the underlying slot
 * startIso string, or null if `listId` isn't a time-list row id. */
export function parseTimeListId(listId: string | null): string | null {
  if (!listId || !listId.startsWith(TIME_LIST_ROW_PREFIX)) return null;
  return listId.slice(TIME_LIST_ROW_PREFIX.length);
}
