import type { BusinessType } from "@/lib/onboarding/types";

export type PlanType = "solo" | "multi";

export interface DiscountPhase {
  phaseOrder: number;
  durationMonths: number;
  discountPercent: number;
}

/** Everything currentPrice() needs, resolved from the DB. */
export interface PricingInput {
  planType: PlanType;
  customMonthlyPrice: number | null;
  discountStartDate: string; // ISO date (YYYY-MM-DD)
  /** Already resolved: business-owned phases if present, else the template's, ordered by phaseOrder. */
  phases: DiscountPhase[];
}

export interface PricingResult {
  listPrice: number;
  discountPercent: number;
  price: number;
  currency: string;
}

/** Re-exported for call sites that want plan/business-type context together. */
export type { BusinessType };
