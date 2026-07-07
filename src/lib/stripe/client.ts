// ---------------------------------------------------------------------------
// Stripe server-side SDK singleton
//
// Reads STRIPE_SECRET_KEY lazily (on first use), not at module load time.
// This matters because this module gets imported by route handlers that
// should be safe to import even when Stripe isn't configured yet — only the
// *call site* that actually needs Stripe should fail, and with a clear
// message, not a cryptic "undefined is not a function" or a build-time crash.
//
// LOCAL-ONLY NOTE: there is no real Stripe account connected yet. Until
// STRIPE_SECRET_KEY is set in `.env.local` (see `.env.example`), calling
// `getStripeClient()` throws a descriptive error. The checkout/webhook route
// handlers catch this and return a clear JSON error instead of a 500.
// ---------------------------------------------------------------------------

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super(
      "Stripe is not configured: missing STRIPE_SECRET_KEY. Create a Stripe " +
        "account at https://dashboard.stripe.com, copy a test-mode secret " +
        "key, and set STRIPE_SECRET_KEY in `.env.local` (see `.env.example`)."
    );
    this.name = "StripeNotConfiguredError";
  }
}

/**
 * Returns a lazily-initialized, memoized Stripe client. Throws
 * `StripeNotConfiguredError` if `STRIPE_SECRET_KEY` isn't set — callers
 * (route handlers) should catch this specifically and respond with a clear
 * 501-style error rather than letting it bubble up as an unhandled 500.
 */
export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new StripeNotConfiguredError();
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2024-06-20",
    typescript: true,
  });

  return stripeClient;
}
