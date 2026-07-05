import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  sendEmail,
  formatBookingWhen,
  bookingCancelledClientHtml,
  bookingCancelledOwnerHtml,
} from "@/lib/email";

/**
 * Cron endpoint — runs every hour via Vercel Cron (see vercel.json).
 * Finds all guest bookings that are still 'pending_confirmation' past their
 * pending_expiry_at deadline, marks them 'cancelled', and emails both the
 * guest (in their locale) and the clinic owner (in Spanish).
 *
 * Secured by the CRON_SECRET env var, which Vercel sets automatically on the
 * Authorization header when invoking cron jobs. Manual calls without the
 * header are rejected with 401.
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron (or a trusted manual caller).
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  // Find all expired pending bookings.
  const { data: expired, error: fetchError } = await supabase
    .from("kalendar_bookings")
    .select(`
      id,
      business_id,
      team_member_id,
      service_name,
      starts_at,
      client_name,
      client_email,
      guest_locale,
      kalendar_businesses!inner (
        name,
        owner_id
      )
    `)
    .eq("status", "pending_confirmation")
    .not("pending_expiry_at", "is", null)
    .lt("pending_expiry_at", now);

  if (fetchError) {
    console.error("[sweep] fetch error:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ swept: 0 });
  }

  const ids = expired.map((b) => b.id);

  // Mark all expired bookings as cancelled in one update.
  const { error: updateError } = await supabase
    .from("kalendar_bookings")
    .update({ status: "cancelled" })
    .in("id", ids)
    .eq("status", "pending_confirmation"); // guard against race conditions

  if (updateError) {
    console.error("[sweep] update error:", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Send emails for each cancelled booking. Best-effort — failures are logged
  // but don't abort the sweep or retry.
  let emailsSent = 0;
  for (const booking of expired) {
    const biz = Array.isArray(booking.kalendar_businesses)
      ? booking.kalendar_businesses[0]
      : booking.kalendar_businesses;

    if (!biz) continue;

    const guestLocale = (booking.guest_locale ?? "es") as "es" | "en";
    const whenLabel = formatBookingWhen(booking.starts_at, guestLocale);
    const ownerWhenLabel = formatBookingWhen(booking.starts_at, "es");

    // Email the guest: booking was not confirmed in time.
    try {
      await sendEmail({
        to: booking.client_email,
        subject:
          guestLocale === "en"
            ? `Booking request not confirmed · ${biz.name}`
            : `Solicitud de reserva no confirmada · ${biz.name}`,
        html: bookingCancelledClientHtml({
          clientName: booking.client_name,
          businessName: biz.name,
          serviceName: booking.service_name,
          whenLabel,
          byOwner: false,
          byExpiry: true,
          locale: guestLocale,
        }),
      });
      emailsSent++;
    } catch (e) {
      console.error("[sweep] guest email failed:", booking.id, e);
    }

    // Email the owner: a pending booking expired (Spanish).
    try {
      const { data: owner } = await supabase
        .from("user")
        .select("email")
        .eq("id", biz.owner_id)
        .maybeSingle();

      if (owner?.email) {
        await sendEmail({
          to: owner.email,
          subject: `Reserva caducada: ${booking.service_name}`,
          html: bookingCancelledOwnerHtml({
            serviceName: booking.service_name,
            whenLabel: ownerWhenLabel,
            clientName: booking.client_name,
            providerName: null,
          }),
        });
        emailsSent++;
      }
    } catch (e) {
      console.error("[sweep] owner email failed:", booking.id, e);
    }
  }

  console.log(`[sweep] cancelled ${ids.length} bookings, sent ${emailsSent} emails`);
  return NextResponse.json({ swept: ids.length, emailsSent });
}
