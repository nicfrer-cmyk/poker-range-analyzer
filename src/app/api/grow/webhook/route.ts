// ---------------------------------------------------------------------------
// POST /api/grow/webhook
//
// Grow calls this URL (passed as `notifyUrl` in /api/grow/checkout) after a
// payment completes. The public docs confirm this happens, but do NOT
// document (a) the exact payload field names for this specific integration,
// or (b) how to verify the call genuinely came from Grow and not a forged
// request from anyone who knows this URL. Grow's docs say webhooks must be
// "enabled for your account" by their support team — that's almost
// certainly where an official verification mechanism gets communicated.
//
// Self-verification in the meantime: only we ever set `notifyUrl` (at
// checkout time, src/app/api/grow/checkout/route.ts), so it embeds a shared
// secret as a `?t=` query token. A request that doesn't carry the matching
// token cannot have come from a checkout session we created — so until Grow
// support confirms an official mechanism, that's a reasonable stand-in.
//
// Fail-closed: if GROW_WEBHOOK_SHARED_SECRET isn't set, or the incoming
// token doesn't match (timing-safe comparison), this behaves exactly like
// the old stub — log only, return 200, zero DB writes. Only a verified
// request touches the database.
//
// TODO before dropping the self-verification fallback:
//   1. Ask Grow support to confirm the official verification mechanism
//      (HMAC signature header? IP allowlist?) once webhooks are enabled for
//      the account, and switch to that instead/in addition.
//   2. Confirm the real payload field names against a sandbox transaction —
//      `getStringField`'s candidate lists below are best-effort guesses.
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { PRO_PRICING_ILS } from "@/lib/grow/plans";

function tokensMatch(expected: string, actual: string | null): boolean {
  if (!actual) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Defensively pulls a field out of the payload by trying several plausible key names,
 *  and one level of nesting under `data` — Grow's exact shape for this integration isn't
 *  confirmed against a real sandbox account yet (see file header). */
function getStringField(payload: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number") return String(value);
  }
  const nested = payload.data;
  if (nested && typeof nested === "object") {
    return getStringField(nested as Record<string, unknown>, keys);
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let payload: Record<string, unknown> | null = null;
  try {
    payload = contentType.includes("application/json")
      ? ((await request.json()) as Record<string, unknown>)
      : (Object.fromEntries((await request.formData()).entries()) as Record<string, unknown>);
  } catch {
    payload = null;
  }

  const sharedSecret = process.env.GROW_WEBHOOK_SHARED_SECRET;
  const token = request.nextUrl.searchParams.get("t");

  if (!sharedSecret || !tokensMatch(sharedSecret, token)) {
    console.warn(
      "Grow webhook received but NOT trusted (missing/invalid token — see route header comment):",
      payload
    );
    return NextResponse.json({ received: true });
  }

  console.warn("Grow webhook verified — raw payload:", payload);

  if (!payload) {
    console.error("Grow webhook: token verified but the body could not be parsed as JSON or form data.");
    return NextResponse.json({ received: true });
  }

  const userId = getStringField(payload, ["cField1", "cfield1", "c_field_1", "cField_1"]);
  if (!userId) {
    console.error("Grow webhook: token verified but no cField1 (our userId) found in payload:", payload);
    return NextResponse.json({ received: true });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      console.error(`Grow webhook: token verified but no user exists for cField1=${userId}`);
      return NextResponse.json({ received: true });
    }

    const amountRaw = getStringField(payload, ["sum", "Sum", "amount", "Amount"]);
    if (amountRaw) {
      const amount = Number(amountRaw);
      const knownAmounts = [PRO_PRICING_ILS.monthly.amountIls, PRO_PRICING_ILS.annual.amountIls];
      if (!Number.isFinite(amount) || !knownAmounts.includes(amount)) {
        console.warn(
          `Grow webhook: amount mismatch for user ${userId} — received "${amountRaw}", expected one of ` +
            `[${knownAmounts.join(", ")}]. Not rejecting the upgrade, just flagging for review.`
        );
      }
    }

    const transactionId = getStringField(payload, [
      "transactionId",
      "transaction_id",
      "dealId",
      "deal_id",
      "asmachta",
      "tranId",
      "processId",
      "processToken",
    ]);

    if (transactionId) {
      const existing = await prisma.subscription.findUnique({
        where: { userId },
        select: { providerTransactionId: true },
      });
      if (existing?.providerTransactionId === transactionId) {
        console.warn(
          `Grow webhook: transaction ${transactionId} already processed for user ${userId} — skipping duplicate.`
        );
        return NextResponse.json({ received: true });
      }
    }

    // Round-trip through JSON so only plain, Json-column-safe data reaches Prisma (form data
    // can't contain anything exotic here, but this is a cheap guarantee either way).
    const safePayload = JSON.parse(JSON.stringify(payload));

    await prisma.$transaction([
      prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          provider: "grow",
          plan: "PRO",
          status: "active",
          providerTransactionId: transactionId ?? null,
          rawPayload: safePayload,
        },
        update: {
          provider: "grow",
          plan: "PRO",
          status: "active",
          providerTransactionId: transactionId ?? undefined,
          rawPayload: safePayload,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { plan: "PRO" },
      }),
    ]);

    console.warn(`Grow webhook: upgraded user ${userId} to PRO (transactionId=${transactionId ?? "none"}).`);
  } catch (err) {
    console.error("Grow webhook: verified request but processing it failed:", err);
  }

  return NextResponse.json({ received: true });
}
