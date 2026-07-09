// ---------------------------------------------------------------------------
// POST /api/stripe/checkout
//
// Creates a Stripe Checkout Session (subscription mode) for the currently
// authenticated user and returns its URL for the client to redirect to.
//
// Body: { "interval": "monthly" | "annual" }
//
// LOCAL-ONLY NOTE: there is no real Stripe account or Supabase project
// connected yet. If either is missing, this returns a 501 with a clear JSON
// error body instead of throwing — see `.env.example` for what to set.
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, StripeNotConfiguredError } from "@/lib/stripe/client";
import { getStripePriceId, type BillingInterval } from "@/lib/stripe/plans";
import { prisma } from "@/lib/prisma";

function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

export async function POST(request: NextRequest) {
  // --- Parse + validate the request body -----------------------------
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

  // --- Resolve the authenticated user via Supabase --------------------
  let userId: string;
  let userEmail: string | undefined;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "You must be signed in to start checkout." },
        { status: 401 }
      );
    }
    userId = user.id;
    userEmail = user.email ?? undefined;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Supabase is not configured")) {
      return NextResponse.json(
        {
          error:
            "Supabase is not configured yet, so there is no signed-in user to " +
            "check out. Set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY " +
            "(see .env.example) and try again.",
        },
        { status: 501 }
      );
    }
    throw err;
  }

  // --- Resolve the Stripe Price ID for the requested interval ---------
  const priceId = getStripePriceId(interval);
  if (!priceId) {
    return NextResponse.json(
      {
        error: `Stripe is not fully configured: missing price ID for "${interval}". ` +
          "Set STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_PRO_ANNUAL (see .env.example) " +
          "once real Stripe Price objects exist.",
      },
      { status: 501 }
    );
  }

  // --- Create the Checkout Session ------------------------------------
  try {
    const stripe = getStripeClient();

    // Reuse an existing Stripe customer if we've already created one for
    // this user (via a prior Subscription row); otherwise let Checkout
    // create one automatically and we'll persist it in the webhook handler
    // once `checkout.session.completed` fires.
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    });

    const origin =
      request.headers.get("origin") ??
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: existingSubscription?.stripeCustomerId ?? undefined,
      customer_email: existingSubscription?.stripeCustomerId ? undefined : userEmail,
      client_reference_id: userId,
      subscription_data: {
        metadata: { userId },
      },
      metadata: { userId, interval },
      success_url: `${origin}/billing?checkout=success`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a Checkout URL. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    console.error("Stripe checkout session creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    );
  }
}
