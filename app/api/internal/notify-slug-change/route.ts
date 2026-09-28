import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, slugChangedOwnerHtml } from "@/lib/email";
import { logEvent } from "@/lib/server-error-log";
import { ERROR_CODES } from "@/lib/error-codes";

/**
 * Internal, secret-gated endpoint that sends the "your booking page address
 * changed" notice (admin-portal-tools.md customer-dashboard, section 3).
 * The admin portal writes kalendar_slug_history / kalendar_businesses.slug
 * directly (same Supabase project, service-role client — no cross-repo call
 * needed for the write itself), but email sending only exists in THIS repo
 * (lib/email.ts, Resend), so the admin portal calls this route right after
 * a successful slug change to trigger the notice. Same shape as
 * INTERNAL_SCHEMA_API_SECRET / app/api/internal/schema/route.ts.
 *
 * Best-effort from the caller's perspective: a failure here should never
 * block the admin's slug change, which has already been committed by the
 * time this is called.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_SLUG_NOTIFY_SECRET) {
    void logEvent("notify-slug-change", "warning", "unauthorized request", {
      code: ERROR_CODES.SLUG_CHANGE_NOTIFY_UNAUTHORIZED,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { businessId?: string; oldSlug?: string; newSlug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { businessId, oldSlug, newSlug } = body;
  if (!businessId || !oldSlug || !newSlug) {
    return NextResponse.json({ error: "businessId, oldSlug, and newSlug are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: business } = await supabase
    .from("kalendar_businesses")
    .select("name, contact_email")
    .eq("id", businessId)
    .maybeSingle();

  if (!business?.contact_email) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  try {
    await sendEmail({
      to: business.contact_email,
      subject: "[Kalendar] La dirección de tu página de reservas ha cambiado",
      html: slugChangedOwnerHtml({
        businessName: business.name,
        oldSlug,
        newSlug,
        newUrl: `${base}/bookings/${newSlug}`,
      }),
    });
  } catch (e) {
    void logEvent("notify-slug-change", "error", "slug-change notice send failed", {
      code: ERROR_CODES.SLUG_CHANGE_NOTIFY_EMAIL_FAILED,
      businessId,
      data: { oldSlug, newSlug, error: String(e) },
    });
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
