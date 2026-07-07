// ---------------------------------------------------------------------------
// Grow (Meshulam) payment-page client config
//
// Grow (grow-il.readme.io, formerly branded Meshulam) is an Israeli payment
// gateway. Unlike Stripe, there's no official Node SDK — integration is a
// direct HTTPS call to their "Light API" (`createPaymentProcess`), which
// returns a hosted payment-page URL to redirect the customer to.
//
// LOCAL-ONLY NOTE: there is no real Grow merchant account connected yet.
// `GROW_USER_ID` / `GROW_PAGE_CODE` come from Grow support once an account
// is approved — see `.env.example`. Until then, `getGrowConfig()` throws
// `GrowNotConfiguredError` and the checkout route returns a clear 501.
//
// IMPORTANT — what's still unverified (see ROADMAP.md for the full note):
// the public docs (grow-il.readme.io) only exposed a *subset* of the API as
// machine-readable text; the "Payment Page" and "Webhooks" overview pages
// render their parameter tables client-side and weren't extractable. The
// `createPaymentProcess` request shape below is real (confirmed from the
// "Regular Payment SDK" reference page), but:
//   - The production base URL is inferred (`secure.meshulam.co.il`, mirroring
//     the confirmed sandbox host `sandbox.meshulam.co.il`) — not directly
//     confirmed in the docs. Verify with Grow support before going live.
//   - The webhook (`notifyUrl`) payload shape and — critically — how to
//     verify a webhook call is genuinely from Grow (shared secret? HMAC
//     signature?) were NOT found in the public docs. The docs say webhooks
//     must be "enabled for your account" by Grow support, which likely
//     comes with the verification details. Do NOT trust the webhook route
//     to upgrade anyone's plan until that's confirmed — see the webhook
//     route's own comment.
// ---------------------------------------------------------------------------

export class GrowNotConfiguredError extends Error {
  constructor() {
    super(
      "Grow is not configured: missing GROW_USER_ID / GROW_PAGE_CODE_CREDIT_CARD. " +
        "These come from Grow support once a merchant account is approved — " +
        "see `.env.example`."
    );
    this.name = "GrowNotConfiguredError";
  }
}

export interface GrowConfig {
  userId: string;
  /** Page code for the "Credit Card" payment page type (one of several Grow page types). */
  pageCodeCreditCard: string;
  /** Sandbox by default — set GROW_API_BASE_URL explicitly once verified for production. */
  apiBaseUrl: string;
}

const DEFAULT_SANDBOX_BASE_URL = "https://sandbox.meshulam.co.il/api/light/server/1.0";

/** Throws `GrowNotConfiguredError` if the required env vars aren't set. */
export function getGrowConfig(): GrowConfig {
  const userId = process.env.GROW_USER_ID;
  const pageCodeCreditCard = process.env.GROW_PAGE_CODE_CREDIT_CARD;

  if (!userId || !pageCodeCreditCard) {
    throw new GrowNotConfiguredError();
  }

  return {
    userId,
    pageCodeCreditCard,
    apiBaseUrl: process.env.GROW_API_BASE_URL || DEFAULT_SANDBOX_BASE_URL,
  };
}
