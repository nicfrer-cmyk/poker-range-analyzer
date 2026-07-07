// ---------------------------------------------------------------------------
// Stripe plan/price configuration
//
// Maps our internal plan names to Stripe Price IDs (read from env — there
// are no real Stripe products/prices created yet, see `.env.example`) plus
// the display pricing shown on `src/app/billing/page.tsx`.
//
// PLACEHOLDER PRICING: the spec calls out Pro at "~$12-15/mo, annual ~30%
// discount" pending real market research. This file picks concrete numbers
// ($14/mo, ~30% off annual -> ~$117.60/yr, rounded to $118/yr) so the UI has
// something to render — treat these as placeholders to revisit, not final
// pricing decisions.
// ---------------------------------------------------------------------------

export type BillingInterval = "monthly" | "annual";

export interface PlanPricing {
  displayName: string;
  /** Price in whole US dollars (not cents) — for display only. */
  amountUsd: number;
  interval: BillingInterval;
  /** Percent discount vs. paying monthly for a year, for display only. */
  discountPercentVsMonthly?: number;
}

/** PLACEHOLDER pricing pending real market research — see file header. */
export const PRO_PRICING: Record<BillingInterval, PlanPricing> = {
  monthly: {
    displayName: "Pro Monthly",
    amountUsd: 14,
    interval: "monthly",
  },
  annual: {
    displayName: "Pro Annual",
    amountUsd: 118, // ~30% off $14 x 12 = $168/yr -> $117.60, rounded
    interval: "annual",
    discountPercentVsMonthly: 30,
  },
};

/**
 * Stripe Price IDs, read from env. These are `undefined` until a real
 * Stripe account + products/prices exist (see `.env.example`:
 * `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`). Checked for
 * presence at the point of use (the checkout route), not at import time.
 */
export const STRIPE_PRICE_IDS: Record<BillingInterval, string | undefined> = {
  monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
};

export function getStripePriceId(interval: BillingInterval): string | undefined {
  return STRIPE_PRICE_IDS[interval];
}
