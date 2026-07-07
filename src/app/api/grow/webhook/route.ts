// ---------------------------------------------------------------------------
// POST /api/grow/webhook
//
// STUB — intentionally does NOT upgrade anyone's plan yet.
//
// Grow calls this URL (passed as `notifyUrl` in /api/grow/checkout) after a
// payment completes. The public docs confirm this happens, but do NOT
// document (a) the exact payload field names for this specific integration,
// or (b) how to verify the call genuinely came from Grow and not a forged
// request from anyone who knows this URL. Grow's docs say webhooks must be
// "enabled for your account" by their support team — that's almost
// certainly where the verification mechanism (shared secret / signature)
// gets communicated.
//
// Blindly trusting this payload today would mean anyone who guesses this
// URL could POST a fake "payment succeeded" and upgrade their account for
// free — so until the verification mechanism is confirmed with Grow
// support, this route only logs what it receives (to compare against real
// payloads once webhooks are enabled) and returns 200 so Grow doesn't retry
// forever, without touching the Subscription table at all.
//
// TODO before this can safely upgrade anyone:
//   1. Get Grow support to enable webhooks for the account and confirm the
//      verification mechanism (shared secret to compare? HMAC signature
//      header? IP allowlist?).
//   2. Implement that check FIRST, reject anything that fails it.
//   3. Only then: look up the Subscription row by the `cField1` value
//      (= our internal userId, set in /api/grow/checkout) and mark it PRO.
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let payload: unknown;
  try {
    payload = contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  } catch {
    payload = null;
  }

  console.warn(
    "Grow webhook received but NOT yet trusted/processed (verification mechanism unconfirmed — see route comment):",
    payload
  );

  return NextResponse.json({ received: true });
}
