import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { currentDiscountPercent } from "@/lib/pricing/compute";
import { resolvePhases } from "@/lib/pricing/data";

/**
 * Cron endpoint — runs daily. Compares yesterday's currentDiscountPercent to
 * today's for every business; if they differ, the business just crossed a
 * discount phase boundary. Sends a notification email. This is the ENTIRE
 * responsibility of this cron — it does not compute, store, or mutate any
 * pricing data (currentPrice/currentDiscountPercent are always derived on
 * read). See docs/specs/pricing-and-discounts-spec.md section 5.
 *
 * NOTE (coordination point flagged in docs/specs/stripe-subscription-billing-spec.md
 * section 4a): once a business has an active Stripe subscription, a phase
 * boundary crossing here does NOT yet push an updated price to Stripe — the
 * subscription keeps renewing at the price that was locked in at Checkout
 * time. This cron currently only notifies; extending it (or a sibling job)
 * to also call stripe.subscriptions.update() with a new price_data line item
 * at the boundary is a tracked fast-follow, not yet built.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: businesses, error } = await supabase
    .from("kalendar_businesses")
    .select("id, name, discount_template_id, discount_start_date, contact_email")
    .not("onboarding_completed_at", "is", null);

  if (error) {
    console.error("[pricing-phase-notify] fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  let notified = 0;

  for (const biz of businesses ?? []) {
    try {
      const phases = await resolvePhases(biz.id, biz.discount_template_id);
      if (phases.length === 0) continue; // no schedule -> always full price, never crosses a boundary

      const todayPercent = currentDiscountPercent(biz.discount_start_date, phases, today);
      const yesterdayPercent = currentDiscountPercent(biz.discount_start_date, phases, yesterday);

      if (todayPercent === yesterdayPercent) continue;

      if (!biz.contact_email) continue;

      await sendEmail({
        to: biz.contact_email,
        subject: `Tu precio de suscripción cambia hoy · ${biz.name}`,
        html: `<p>Hola,</p><p>Tu precio de suscripción a Kalendar cambia a partir de hoy: pasas de un ${yesterdayPercent}% de descuento a un ${todayPercent}% de descuento sobre el precio de lista.</p><p>Si tienes alguna duda, responde a este correo o contacta con soporte.</p>`,
      });
      notified++;
    } catch (e) {
      console.error("[pricing-phase-notify] failed for business", biz.id, e);
    }
  }

  console.log(`[pricing-phase-notify] notified ${notified} businesses`);
  return NextResponse.json({ notified });
}
