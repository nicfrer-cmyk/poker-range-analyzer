// ---------------------------------------------------------------------------
// POST /api/stripe/webhook
//
// Verifies the Stripe webhook signature and syncs subscription state into
// our own database (the `Subscription` table + `User.plan`) for:
//   - checkout.session.completed
//   - customer.subscription.updated
//   - customer.subscription.deleted
//
// IMPORTANT: Stripe signature verification needs the *raw* request body, so
// this reads `request.text()` — never `request.json()` — before verifying.
//
// LOCAL-ONLY NOTE: there is no real Stripe account connected yet. Until
// STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are set (see `.env.example`),
// this returns a 501 JSON error instead of throwing on every incoming
// (nonexistent, for now) webhook call.
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, StripeNotConfiguredError } from "@/lib/stripe/client";
import { prisma } from "@/lib/prisma";
import type { Plan } from "@prisma/client";

// Route handlers already receive the raw, unparsed request body via
// `request.text()`, so no special `bodyParser` config is needed (that's a
// Pages Router concept) — just make sure nothing upstream parses it first.
export const dynamic = "force-dynamic";

/** Maps a Stripe subscription status to our internal Plan. */
function planForStatus(status: Stripe.Subscription.Status): Plan {
  return status === "active" || status === "trialing" ? "PRO" : "FREE";
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      {
        error:
          "Stripe webhooks are not configured: missing STRIPE_WEBHOOK_SECRET. " +
          "Set it once a real Stripe webhook endpoint exists (see .env.example).",
      },
      { status: 501 }
    );
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    throw err;
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  // Read the RAW body — constructEvent needs the exact bytes Stripe signed.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.userId;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!userId || !customerId) {
          console.error(
            "checkout.session.completed missing userId/customerId; skipping.",
            { userId, customerId }
          );
          break;
        }

        let status = "active";
        let currentPeriodEnd: Date | null = null;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          status = subscription.status;
          currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        }

        const plan = planForStatus(status as Stripe.Subscription.Status);

        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId ?? null,
            plan,
            status,
            currentPeriodEnd,
          },
          update: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId ?? null,
            plan,
            status,
            currentPeriodEnd,
          },
        });

        await prisma.user.update({ where: { id: userId }, data: { plan } });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const plan = planForStatus(subscription.status);
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

        const existing = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
          select: { userId: true },
        });

        if (!existing) {
          console.error(
            "customer.subscription.updated for unknown subscription id:",
            subscription.id
          );
          break;
        }

        await prisma.subscription.update({
          where: { userId: existing.userId },
          data: { plan, status: subscription.status, currentPeriodEnd },
        });
        await prisma.user.update({ where: { id: existing.userId }, data: { plan } });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const existing = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
          select: { userId: true },
        });

        if (!existing) {
          console.error(
            "customer.subscription.deleted for unknown subscription id:",
            subscription.id
          );
          break;
        }

        await prisma.subscription.update({
          where: { userId: existing.userId },
          data: { plan: "FREE", status: "canceled" },
        });
        await prisma.user.update({
          where: { id: existing.userId },
          data: { plan: "FREE" },
        });
        break;
      }

      default:
        // Unhandled event type — acknowledge so Stripe doesn't retry.
        break;
    }
  } catch (err) {
    console.error(`Error handling Stripe webhook event ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
