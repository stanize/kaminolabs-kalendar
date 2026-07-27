import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/billing/stripe";

/**
 * Cron endpoint — runs daily. Backup safety net, NOT the primary sync
 * mechanism (webhooks are primary — see app/api/webhooks/stripe/route.ts).
 * For every business with a stripe_subscription_id, fetches the current
 * status from Stripe's API and compares to the stored subscription_status.
 * Logs (does not silently auto-correct) any mismatch — a mismatch means a
 * webhook was missed and is worth knowing about, not just papering over.
 * See docs/specs/stripe-subscription-billing-spec.md section 7.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const supabase = await createClient();

  const { data: businesses, error } = await supabase
    .from("kalendar_businesses")
    .select("id, stripe_subscription_id, subscription_status")
    .not("stripe_subscription_id", "is", null);

  if (error) {
    console.error("[stripe-reconcile] fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let checked = 0;
  let mismatches = 0;

  for (const biz of businesses ?? []) {
    if (!biz.stripe_subscription_id) continue;
    checked++;

    try {
      const subscription = await stripe.subscriptions.retrieve(biz.stripe_subscription_id);
      if (subscription.status !== biz.subscription_status) {
        mismatches++;
        console.error(
          `[stripe-reconcile] MISMATCH business=${biz.id} stored=${biz.subscription_status} stripe=${subscription.status} — a webhook was likely missed`
        );
      }
    } catch (e) {
      console.error(`[stripe-reconcile] fetch failed for business=${biz.id}:`, e);
    }
  }

  console.log(`[stripe-reconcile] checked ${checked}, ${mismatches} mismatches found`);
  return NextResponse.json({ checked, mismatches });
}
