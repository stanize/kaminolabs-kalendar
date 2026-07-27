import { createClient } from "@/lib/supabase/server";
import { currentPrice as computeCurrentPrice } from "@/lib/pricing/compute";
import type { DiscountPhase, PlanType, PricingResult } from "@/lib/pricing/types";

/**
 * Resolves a business's phase list: business-owned ad hoc phases take
 * precedence over the referenced template's phases, per
 * docs/specs/pricing-and-discounts-spec.md section 2.
 */
export async function resolvePhases(
  businessId: string,
  discountTemplateId: string | null
): Promise<DiscountPhase[]> {
  const supabase = await createClient();

  const { data: ownPhases } = await supabase
    .from("kalendar_discount_schedule_phases")
    .select("phase_order, duration_months, discount_percent")
    .eq("business_id", businessId)
    .order("phase_order", { ascending: true });

  if (ownPhases && ownPhases.length > 0) {
    return ownPhases.map(toPhase);
  }

  if (!discountTemplateId) return [];

  const { data: templatePhases } = await supabase
    .from("kalendar_discount_schedule_phases")
    .select("phase_order, duration_months, discount_percent")
    .eq("template_id", discountTemplateId)
    .order("phase_order", { ascending: true });

  return (templatePhases ?? []).map(toPhase);
}

function toPhase(row: {
  phase_order: number;
  duration_months: number;
  discount_percent: number;
}): DiscountPhase {
  return {
    phaseOrder: row.phase_order,
    durationMonths: row.duration_months,
    discountPercent: row.discount_percent,
  };
}

/**
 * Full pricing resolution for a business, used both for display (panel) and
 * for computing the amount to charge at Stripe Checkout-session-creation
 * time. Always derived on read — nothing is cached or stored.
 */
export async function getBusinessPricing(businessId: string): Promise<PricingResult | null> {
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("kalendar_businesses")
    .select("plan_type, custom_monthly_price, discount_template_id, discount_start_date")
    .eq("id", businessId)
    .maybeSingle();

  if (!business) return null;

  const planType = business.plan_type as PlanType;

  const { data: planPrice } = await supabase
    .from("kalendar_plan_prices")
    .select("monthly_price, currency")
    .eq("plan_type", planType)
    .maybeSingle();

  // Should always exist (seeded), but guard rather than throw if it's ever missing.
  const listPriceForPlan = planPrice?.monthly_price ?? 0;
  const currency = planPrice?.currency ?? "EUR";

  const phases = await resolvePhases(businessId, business.discount_template_id);

  return computeCurrentPrice(
    {
      planType,
      customMonthlyPrice: business.custom_monthly_price,
      discountStartDate: business.discount_start_date,
      phases,
    },
    listPriceForPlan,
    currency
  );
}
