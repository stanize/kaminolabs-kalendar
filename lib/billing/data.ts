import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "unpaid";

export interface BillingState {
  businessId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionCurrentPeriodEnd: string | null;
}

export async function getBillingState(businessId: string): Promise<BillingState | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_businesses")
    .select(
      "id, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end"
    )
    .eq("id", businessId)
    .maybeSingle();

  if (!data) return null;

  return {
    businessId: data.id,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    subscriptionStatus: data.subscription_status as SubscriptionStatus,
    subscriptionCurrentPeriodEnd: data.subscription_current_period_end,
  };
}
