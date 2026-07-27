import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatBusinessAddress } from "@/lib/business/data";
import {
  sendEmail,
  formatBookingWhen,
  appointmentReminder24hEmailHtml,
  appointmentReminder1hEmailHtml,
  reminderEmailSubject,
  EMAIL_LOCALE,
} from "@/lib/email";

/**
 * Cron endpoint — runs every 15 minutes via GitHub Actions
 * (.github/workflows/reminders-cron.yml), same pattern as
 * sweep-expired-bookings. Sends the 24h-before and 1h-before reminder emails
 * for CONFIRMED bookings only (pending_confirmation bookings have their own
 * expiry/sweep flow and never get reminders).
 *
 * Idempotency: reminder_24h_sent_at / reminder_1h_sent_at are NULL until a
 * send succeeds, and are only set AFTER the send succeeds — so a crash
 * mid-batch leaves the row eligible for retry on the next run rather than
 * silently skipped, and a booking that already has the column set is never
 * re-queried into the candidate set.
 *
 * Safety: status = 'confirmed' is re-checked in the same query used to fetch
 * candidates (not trusted from a stale earlier read), so a booking cancelled
 * between cron runs is naturally excluded without extra bookkeeping.
 *
 * Windows: ±15min around each target, matching the 15-minute cron interval
 * so no booking is missed to cron jitter:
 *   24h window: now()+23h45m .. now()+24h15m
 *   1h window:  now()+45m    .. now()+1h15m
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const now = Date.now();

  const win24Start = new Date(now + (23 * 60 + 45) * 60_000).toISOString();
  const win24End = new Date(now + (24 * 60 + 15) * 60_000).toISOString();
  const win1Start = new Date(now + 45 * 60_000).toISOString();
  const win1End = new Date(now + 75 * 60_000).toISOString();

  const SELECT = `
    id,
    business_id,
    team_member_id,
    service_name,
    starts_at,
    client_name,
    client_email,
    guest_locale,
    confirm_token,
    kalendar_businesses!inner (
      name,
      address_street,
      address_number,
      address_additional,
      city,
      brand_color,
      team_mode
    )
  `;

  const [due24, due1] = await Promise.all([
    supabase
      .from("kalendar_bookings")
      .select(SELECT)
      .eq("status", "confirmed")
      .is("reminder_24h_sent_at", null)
      .gte("starts_at", win24Start)
      .lte("starts_at", win24End),
    supabase
      .from("kalendar_bookings")
      .select(SELECT)
      .eq("status", "confirmed")
      .is("reminder_1h_sent_at", null)
      .gte("starts_at", win1Start)
      .lte("starts_at", win1End),
  ]);

  if (due24.error || due1.error) {
    const message = due24.error?.message ?? due1.error?.message ?? "unknown error";
    console.error("[reminders] fetch error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let sent24 = 0;
  let sent1 = 0;
  let failed = 0;

  for (const booking of due24.data ?? []) {
    const ok = await sendReminder(supabase, booking, "24h");
    if (ok) sent24++;
    else failed++;
  }

  for (const booking of due1.data ?? []) {
    const ok = await sendReminder(supabase, booking, "1h");
    if (ok) sent1++;
    else failed++;
  }

  console.log(`[reminders] sent24=${sent24} sent1=${sent1} failed=${failed}`);
  return NextResponse.json({ sent24, sent1, failed });
}

type CandidateBooking = {
  id: string;
  business_id: string;
  team_member_id: string | null;
  service_name: string;
  starts_at: string;
  client_name: string;
  client_email: string;
  guest_locale: "es" | "en" | null;
  confirm_token: string;
  kalendar_businesses:
    | {
        name: string;
        address_street: string;
        address_number: string;
        address_additional: string | null;
        city: string;
        brand_color: string;
        team_mode: "solo" | "team";
      }
    | {
        name: string;
        address_street: string;
        address_number: string;
        address_additional: string | null;
        city: string;
        brand_color: string;
        team_mode: "solo" | "team";
      }[];
};

/**
 * Sends one reminder email and marks it sent — or records the failure —
 * returning whether the send itself succeeded. Never throws: a bad row
 * should not abort the rest of the batch.
 */
async function sendReminder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  booking: CandidateBooking,
  variant: "24h" | "1h"
): Promise<boolean> {
  const biz = Array.isArray(booking.kalendar_businesses)
    ? booking.kalendar_businesses[0]
    : booking.kalendar_businesses;
  if (!biz) return false;

  // Re-check status at send time, not just at query time — a booking
  // cancelled in the gap between the query and this send should not get a
  // reminder for an appointment that no longer exists.
  const { data: fresh } = await supabase
    .from("kalendar_bookings")
    .select("status")
    .eq("id", booking.id)
    .maybeSingle();
  if (fresh?.status !== "confirmed") return true; // not a failure — just no longer applicable

  // Reminder content is pinned to Spanish for now (EMAIL_LOCALE, see
  // lib/email.ts) regardless of the booking's stored guest_locale.
  const whenLabel = formatBookingWhen(booking.starts_at, EMAIL_LOCALE);
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const cancelUrl = `${base}/bookings/cancel/${booking.confirm_token}`;

  let providerName: string | null = null;
  if (booking.team_member_id && biz.team_mode === "team") {
    const { data: member } = await supabase
      .from("kalendar_team_members")
      .select("name")
      .eq("id", booking.team_member_id)
      .maybeSingle();
    providerName = member?.name ?? null;
  }

  const html = (variant === "24h" ? appointmentReminder24hEmailHtml : appointmentReminder1hEmailHtml)({
    clientName: booking.client_name,
    businessName: biz.name,
    serviceName: booking.service_name,
    whenLabel,
    providerName,
    businessAddress: formatBusinessAddress(biz),
    cancelUrl,
    locale: EMAIL_LOCALE,
    brandColor: biz.brand_color,
  });

  const sentAtColumn = variant === "24h" ? "reminder_24h_sent_at" : "reminder_1h_sent_at";

  const result = await sendEmail({
    to: booking.client_email,
    subject: reminderEmailSubject(variant, biz.name, EMAIL_LOCALE),
    html,
  });

  if (!result.ok) {
    console.error(`[reminders] ${variant} send failed for booking ${booking.id}: ${result.error}`);
    await supabase
      .from("kalendar_bookings")
      .update({ reminder_send_failed: true, last_reminder_error: result.error })
      .eq("id", booking.id);
    return false;
  }

  // Set the sent-at column AFTER the successful send, and clear any prior
  // failure flag — a later successful retry supersedes an earlier failure.
  await supabase
    .from("kalendar_bookings")
    .update({ [sentAtColumn]: new Date().toISOString(), reminder_send_failed: false, last_reminder_error: null })
    .eq("id", booking.id);

  return true;
}
