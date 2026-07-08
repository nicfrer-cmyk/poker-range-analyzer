// ---------------------------------------------------------------------------
// POST /api/grow/checkout
//
// Creates a Grow (Meshulam) hosted payment-page session for the currently
// authenticated user and returns its URL for the client to redirect to.
// Mirrors /api/stripe/checkout's shape (still present but no longer the
// active provider — see billing/page.tsx and ROADMAP.md).
//
// Body: { "interval": "monthly" | "annual" }
//
// STATUS: real plumbing, calls Grow's actual createPaymentProcess endpoint —
// but the exact success-response JSON shape wasn't in the public docs (see
// src/lib/grow/client.ts's header comment), so this defensively checks a
// few plausible field names and fails loudly (502, with the raw response
// logged server-side) rather than guessing wrong silently. Verify against
// a real Grow sandbox account and adjust `extractPaymentUrl` once confirmed.
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGrowConfig, GrowNotConfiguredError } from "@/lib/grow/client";
import { PRO_PRICING_ILS, type BillingInterval } from "@/lib/grow/plans";

function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

/** Grow's confirmed success response shape wasn't in the public docs — try the
 *  plausible field names a Light API response would use before giving up. */
function extractPaymentUrl(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const candidates = [b.url, b.paymentPageUrl, (b.data as Record<string, unknown> | undefined)?.url];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("http")) return c;
  }
  return null;
}

export async function POST(request: NextRequest) {
  let interval: BillingInterval;
  try {
    const body = (await request.json()) as { interval?: unknown };
    if (!isBillingInterval(body.interval)) {
      return NextResponse.json(
        { error: "Invalid request: `interval` must be \"monthly\" or \"annual\"." },
        { status: 400 }
      );
    }
    interval = body.interval;
  } catch {
    return NextResponse.json(
      { error: "Invalid request: expected a JSON body with an `interval` field." },
      { status: 400 }
    );
  }

  let userId: string;
  let userEmail: string | undefined;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "You must be signed in to start checkout." }, { status: 401 });
    }
    userId = user.id;
    userEmail = user.email ?? undefined;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Supabase is not configured")) {
      return NextResponse.json(
        { error: "Supabase is not configured yet, so there is no signed-in user to check out." },
        { status: 501 }
      );
    }
    throw err;
  }

  let config;
  try {
    config = getGrowConfig();
  } catch (err) {
    if (err instanceof GrowNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    throw err;
  }

  const pricing = PRO_PRICING_ILS[interval];
  const origin = request.headers.get("origin") ?? `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  const form = new URLSearchParams();
  form.set("userId", config.userId);
  form.set("pageCode", config.pageCodeCreditCard);
  form.set("sum", String(pricing.amountIls));
  form.set("description", `${pricing.displayName} — מנתח טווחי פוקר`);
  form.set("successUrl", `${origin}/billing?checkout=success`);
  form.set("cancelUrl", `${origin}/billing?checkout=cancelled`);
  // cField1 carries our own userId through the payment flow so the (currently unverified,
  // see webhook route) notifyUrl callback can eventually be matched back to a Subscription row.
  form.set("cField1", userId);
  if (userEmail) form.set("pageField[email]", userEmail);
  form.set("notifyUrl", `${origin}/api/grow/webhook`);

  try {
    const res = await fetch(`${config.apiBaseUrl}/createPaymentProcess`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const raw: unknown = await res.json().catch(() => null);
    const url = extractPaymentUrl(raw);

    if (!res.ok || !url) {
      console.error("Grow createPaymentProcess did not return a usable payment URL:", res.status, raw);
      return NextResponse.json(
        {
          error:
            "התשלום דרך Grow לא הצליח להתחיל — יש לבדוק את התגובה הגולמית ביומן השרת מול תיעוד Grow.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Grow checkout request failed:", err);
    return NextResponse.json({ error: "Failed to create Grow checkout session." }, { status: 500 });
  }
}
