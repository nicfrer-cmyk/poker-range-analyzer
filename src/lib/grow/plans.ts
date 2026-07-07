// ---------------------------------------------------------------------------
// Grow plan/price configuration
//
// PLACEHOLDER PRICING, same status as the old src/lib/stripe/plans.ts prices
// it replaces as the active provider: real market research still pending.
// Priced in ILS (₪) since Grow is an Israeli gateway — these are rough
// conversions of the old $14/mo, $118/yr placeholders, not a real decision.
// ---------------------------------------------------------------------------

export type BillingInterval = "monthly" | "annual";

export interface GrowPlanPricing {
  displayName: string;
  /** Price in whole ILS (₪) — for display, and passed as Grow's `sum` param. */
  amountIls: number;
  interval: BillingInterval;
  discountPercentVsMonthly?: number;
}

/** PLACEHOLDER pricing pending real market research — see file header. */
export const PRO_PRICING_ILS: Record<BillingInterval, GrowPlanPricing> = {
  monthly: {
    displayName: "פרו — חודשי",
    amountIls: 49,
    interval: "monthly",
  },
  annual: {
    displayName: "פרו — שנתי",
    amountIls: 410, // ~30% off 49 x 12 = 588 -> 411.6, rounded
    interval: "annual",
    discountPercentVsMonthly: 30,
  },
};
