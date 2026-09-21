import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  decryptConfigAuthToken,
  validateTwilioSignature,
  twimlReply,
  twimlEmptyReply,
  sendQuickReplyMessage,
  sendServiceListMessage,
  type WhatsappConfigRow,
} from "@/lib/whatsapp/twilio-client";
import { handleIncomingMessage } from "@/lib/whatsapp/conversation";

/**
 * Single webhook route for ALL clinics (workflows/whatsapp-booking.md —
 * webhook-routing step). Twilio's inbound payload always carries the
 * receiving number in the "To" field (`whatsapp:+34XXXXXXXXX`) — the
 * business is resolved by matching that against
 * kalendar_whatsapp_config.twilio_whatsapp_number. No Twilio subaccounts —
 * each clinic owns its own top-level Twilio account and pastes its own
 * credentials in via /panel/business.
 *
 * Twilio sends inbound webhooks as application/x-www-form-urlencoded, not
 * JSON — parsed via request.formData() below, matching Twilio's documented
 * webhook payload shape (From, To, Body, etc.).
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const paramsObj: Record<string, string> = {};
  for (const [key, value] of params.entries()) paramsObj[key] = value;

  const to = paramsObj["To"]; // e.g. "whatsapp:+34600000000"
  const from = paramsObj["From"]; // e.g. "whatsapp:+34611111111"
  const body = paramsObj["Body"] ?? "";
  // Set when the inbound message is a tap on a native twilio/quick-reply
  // button (the "id" we set when creating the template — "confirm"/"cancel")
  // rather than typed text. See lib/whatsapp/twilio-client.ts.
  const buttonPayload = paramsObj["ButtonPayload"] ?? null;
  // Set when the inbound message is a tap on a native whatsapp/card LIST
  // row (the service-selection list) rather than typed text or a button.
  // See lib/whatsapp/twilio-client.ts's parseServiceListId.
  const listId = paramsObj["ListId"] ?? null;

  if (!to || !from) {
    return new NextResponse("Missing To/From", { status: 400 });
  }

  const toNumber = to.replace(/^whatsapp:/, "");
  const fromNumber = from.replace(/^whatsapp:/, "");

  const supabase = await createClient();
  const { data: config } = await supabase
    .from("kalendar_whatsapp_config")
    .select(
      "id, business_id, enabled, twilio_account_sid, twilio_auth_token_encrypted, twilio_whatsapp_number, is_sandbox, quick_reply_content_sid, service_list_content_sid"
    )
    .eq("twilio_whatsapp_number", toNumber)
    .maybeSingle();

  if (!config || !config.enabled) {
    // Unknown number or disabled — respond 200 with no message so Twilio
    // doesn't retry, but do nothing (don't leak whether a number exists).
    return new NextResponse("", { status: 200 });
  }

  const typedConfig = config as WhatsappConfigRow;

  let authToken: string;
  try {
    authToken = decryptConfigAuthToken(typedConfig);
  } catch {
    return new NextResponse("Configuration error", { status: 500 });
  }

  // Signature validation: Twilio signs over the exact webhook URL it was
  // configured to call. NEXT_PUBLIC_APP_URL + this route's path reconstructs
  // that URL — must match exactly what's configured in the Twilio console
  // (no trailing slash mismatch, same protocol/host) or every request fails.
  const configuredBase = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const webhookUrl = `${configuredBase}/api/whatsapp/webhook`;
  const signature = request.headers.get("X-Twilio-Signature");

  const isValid = validateTwilioSignature({
    authToken,
    signature,
    url: webhookUrl,
    body: paramsObj,
  });

  if (!isValid) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  // Resolve the business's slug — getAvailableSlots/getPublicBookingData
  // (lib/actions/booking.ts, lib/booking/data.ts) are slug-scoped, matching
  // the public booking wizard's own entry point, reused as-is here.
  const { data: business } = await supabase
    .from("kalendar_businesses")
    .select("slug")
    .eq("id", typedConfig.business_id)
    .maybeSingle();

  if (!business) {
    return new NextResponse("", { status: 200 });
  }

  const result = await handleIncomingMessage(
    business.slug,
    typedConfig.business_id,
    fromNumber,
    body,
    buttonPayload,
    listId
  );

  if (result.serviceListOptions && result.serviceListOptions.length > 0 && typedConfig.twilio_whatsapp_number) {
    // Service-selection prompt: send as a native whatsapp/card LIST
    // interactive message via the REST API rather than TwiML, then reply to
    // the webhook with an empty TwiML response so Twilio doesn't also relay
    // `reply` as plain text (same pattern as the quick-reply block below).
    try {
      await sendServiceListMessage({
        config: typedConfig,
        accountSid: typedConfig.twilio_account_sid ?? "",
        authToken,
        from: typedConfig.twilio_whatsapp_number,
        to: fromNumber,
        services: result.serviceListOptions,
      });
      return new NextResponse(twimlEmptyReply(), {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    } catch {
      // Content API call failed (e.g. transient Twilio error) — fall back
      // to the plain-text reply below rather than leaving the patient with
      // no response at all.
    }
  }

  if (result.quickReplySummary && typedConfig.twilio_whatsapp_number) {
    // Confirm/Cancel step: send as a native twilio/quick-reply interactive
    // message via the REST API rather than TwiML, then reply to the webhook
    // with an empty TwiML response so Twilio doesn't also relay `reply` as
    // plain text (see twilio-client.ts's twimlEmptyReply doc comment).
    try {
      await sendQuickReplyMessage({
        config: typedConfig,
        accountSid: typedConfig.twilio_account_sid ?? "",
        authToken,
        from: typedConfig.twilio_whatsapp_number,
        to: fromNumber,
        bodyText: result.quickReplySummary,
      });
      return new NextResponse(twimlEmptyReply(), {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    } catch {
      // Content API call failed (e.g. transient Twilio error) — fall back
      // to the plain-text reply below rather than leaving the patient with
      // no response at all.
    }
  }

  const twiml = twimlReply(result.reply);
  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
