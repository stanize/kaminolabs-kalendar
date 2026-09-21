import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  decryptConfigAuthToken,
  validateTwilioSignature,
  twimlReply,
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

  if (!to || !from) {
    return new NextResponse("Missing To/From", { status: 400 });
  }

  const toNumber = to.replace(/^whatsapp:/, "");
  const fromNumber = from.replace(/^whatsapp:/, "");

  const supabase = await createClient();
  const { data: config } = await supabase
    .from("kalendar_whatsapp_config")
    .select(
      "id, business_id, enabled, twilio_account_sid, twilio_auth_token_encrypted, twilio_whatsapp_number, is_sandbox"
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

  const { reply } = await handleIncomingMessage(
    business.slug,
    typedConfig.business_id,
    fromNumber,
    body
  );

  const twiml = twimlReply(reply);
  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
