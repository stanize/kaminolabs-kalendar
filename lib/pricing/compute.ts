import type { DiscountPhase, PricingInput } from "@/lib/pricing/types";

/**
 * Pure computation only — no DB reads or writes. currentPrice() is called
 * wherever a price needs to be displayed or charged; nothing about the
 * discount is ever written back to the business row. It is always recomputed
 * from discountStartDate + today's date + the phase table, so it can never
 * drift out of sync. See docs/specs/pricing-and-discounts-spec.md section 3.
 */

/** Whole calendar months elapsed between two ISO dates (floor, never negative). */
export function wholeMonthsBetween(startDateIso: string, today: Date): number {
  const start = new Date(startDateIso + "T00:00:00Z");
  let months =
    (today.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (today.getUTCMonth() - start.getUTCMonth());
  if (today.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

export function currentDiscountPercent(
  startDateIso: string,
  phases: DiscountPhase[],
  today: Date = new Date()
): number {
  const monthsElapsed = wholeMonthsBetween(startDateIso, today);
  let cursor = 0;
  const ordered = [...phases].sort((a, b) => a.phaseOrder - b.phaseOrder);
  for (const phase of ordered) {
    if (monthsElapsed < cursor + phase.durationMonths) {
      return phase.discountPercent;
    }
    cursor += phase.durationMonths;
  }
  return 0; // exhausted all phases -> full price
}

export function currentPrice(
  input: PricingInput,
  listPriceForPlan: number,
  currency: string,
  today: Date = new Date()
): { listPrice: number; discountPercent: number; price: number; currency: string } {
  const listPrice = input.customMonthlyPrice ?? listPriceForPlan;
  const discountPercent = currentDiscountPercent(input.discountStartDate, input.phases, today);
  const price = round2(listPrice * (1 - discountPercent / 100));
  return { listPrice, discountPercent, price, currency };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
