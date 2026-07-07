// ---------------------------------------------------------------------------
// /billing — plan comparison + upgrade entry point
//
// Server Component. Shows Free vs Pro plan cards (driven by the limits table
// in `src/lib/plan.ts`) and, for a signed-in user, their current plan and
// subscription status (if a `Subscription` row exists).
//
// The "Upgrade to Pro" buttons are plain <form> submissions bound to a
// Server Action defined in this file, which itself POSTs to
// `/api/stripe/checkout` (forwarding the user's auth cookie) and redirects
// the browser to the returned Stripe Checkout URL — or back to this page
// with an error message on failure. This keeps the whole page a single
// Server Component with no separate client-side button component needed.
//
// LOCAL-ONLY NOTE: with no real Supabase/Stripe project connected yet, this
// page still renders (plan cards always show); the upgrade buttons will
// surface a clear inline error instead of crashing until env vars are set —
// see `.env.example`.
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, type Plan } from "@/lib/plan";
import { PRO_PRICING, type BillingInterval } from "@/lib/stripe/plans";

function getOrigin(): string {
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

/** Server Action: POSTs to our own checkout route, then redirects. */
async function upgradeToPro(interval: BillingInterval) {
  "use server";

  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // Note: `redirect()` is intentionally called outside the try/catch below —
  // it works by throwing a special Next.js control-flow error, which a
  // surrounding catch block would otherwise swallow.
  let successUrl: string | undefined;
  let errorMessage: string | undefined;

  try {
    const res = await fetch(`${getOrigin()}/api/stripe/checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader,
      },
      body: JSON.stringify({ interval }),
      cache: "no-store",
    });
    const body = (await res.json()) as { url?: string; error?: string };
    if (res.ok && body.url) {
      successUrl = body.url;
    } else {
      errorMessage = body.error ?? `Checkout failed with status ${res.status}.`;
    }
  } catch {
    errorMessage = "Unexpected error starting checkout.";
  }

  if (successUrl) {
    redirect(successUrl);
  }
  redirect(`/billing?checkout=error&message=${encodeURIComponent(errorMessage ?? "Checkout failed.")}`);
}

const upgradeMonthly = upgradeToPro.bind(null, "monthly");
const upgradeAnnual = upgradeToPro.bind(null, "annual");

interface CurrentSubscription {
  plan: Plan;
  status: string;
  currentPeriodEnd: Date | null;
}

async function getCurrentUserAndSubscription(): Promise<{
  email: string | null;
  subscription: CurrentSubscription | null;
  configError: string | null;
}> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { email: null, subscription: null, configError: null };

    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { plan: true, status: true, currentPeriodEnd: true },
    });

    return { email: user.email ?? null, subscription, configError: null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Supabase is not configured")) {
      return { email: null, subscription: null, configError: err.message };
    }
    throw err;
  }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { checkout?: string; message?: string };
}) {
  const { email, subscription, configError } = await getCurrentUserAndSubscription();

  const checkoutError =
    searchParams.checkout === "error" ? searchParams.message ?? "Checkout failed." : null;
  const checkoutCancelled = searchParams.checkout === "cancelled";
  const checkoutSuccess = searchParams.checkout === "success";

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Billing</h1>
      <p className="mb-6 text-sm opacity-75">
        Poker Range Analyzer — Free vs Pro plans.
      </p>

      {configError && (
        <div className="mb-6 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
          Supabase isn&apos;t configured yet, so we can&apos;t show your account or
          let you check out. ({configError})
        </div>
      )}

      {checkoutError && (
        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          {checkoutError}
        </div>
      )}
      {checkoutCancelled && (
        <div className="mb-6 rounded-2xl border border-white/20 bg-white/5 p-4 text-sm">
          Checkout was cancelled — no changes were made.
        </div>
      )}
      {checkoutSuccess && (
        <div className="mb-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-4 text-sm">
          Thanks! Your subscription is being set up — this page will reflect
          Pro access once Stripe confirms the payment.
        </div>
      )}

      {subscription && (
        <div className="mb-8 rounded-2xl border border-white/20 p-4 text-sm">
          Signed in as <span className="font-medium">{email}</span> — current
          plan: <span className="font-medium">{subscription.plan}</span> (
          {subscription.status}
          {subscription.currentPeriodEnd
            ? `, renews ${subscription.currentPeriodEnd.toLocaleDateString()}`
            : ""}
          )
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Free plan */}
        <div className="rounded-2xl border border-white/20 p-6">
          <h2 className="text-lg font-semibold">Free</h2>
          <p className="mt-1 text-3xl font-bold">$0</p>
          <ul className="mt-4 space-y-2 text-sm opacity-90">
            <li>{PLAN_LIMITS.FREE.dailyAnalysisLimit} hand analyses / day</li>
            <li>Up to {PLAN_LIMITS.FREE.maxSavedHands} saved analyses</li>
            <li>Preset ranges + basic manual range building</li>
            <li>Hero Summary + coach</li>
            <li>Pot odds / SPR / EV calculations</li>
            <li>{PLAN_LIMITS.FREE.dailyImportLimit} hand history imports / day (no bulk)</li>
            <li className="opacity-60">Leak finder &amp; session review — not included</li>
            <li>Basic training mode</li>
            <li className="opacity-60">Range vs. range — not included</li>
            <li className="opacity-60">ICM calculator — not included</li>
            <li>{PLAN_LIMITS.FREE.dailyAiReviewLimit} AI hand review / day</li>
            <li>Up to {PLAN_LIMITS.FREE.maxOpponentProfiles} opponent profiles</li>
            <li className="opacity-60">Data export — not included</li>
            <li>Regular support</li>
          </ul>
        </div>

        {/* Pro plan */}
        <div className="rounded-2xl border border-white/40 p-6">
          <h2 className="text-lg font-semibold">Pro</h2>
          <p className="mt-1 text-3xl font-bold">
            ${PRO_PRICING.monthly.amountUsd}
            <span className="text-base font-normal opacity-70">/mo</span>
          </p>
          <p className="text-xs opacity-60">
            or ${PRO_PRICING.annual.amountUsd}/yr (
            {PRO_PRICING.annual.discountPercentVsMonthly}% off) — placeholder
            pricing pending market research
          </p>
          <ul className="mt-4 space-y-2 text-sm opacity-90">
            <li>Unlimited hand analyses</li>
            <li>Unlimited saved analyses</li>
            <li>Advanced range building with unlimited saves</li>
            <li>Unlimited hand history import, incl. bulk import</li>
            <li>Full leak finder + session review</li>
            <li>Full training mode + tracks</li>
            <li>Range vs. range analysis</li>
            <li>ICM calculator</li>
            <li>Unlimited AI hand review</li>
            <li>Unlimited opponent profiles</li>
            <li>Data export</li>
            <li>Priority support</li>
          </ul>

          {subscription?.plan === "PRO" ? (
            <div className="mt-6 rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-center text-sm">
              You&apos;re on Pro
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              <form action={upgradeMonthly}>
                <button
                  type="submit"
                  disabled={Boolean(configError)}
                  className="w-full rounded-xl border border-white/40 p-3 text-sm font-medium hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Upgrade to Pro — Monthly (${PRO_PRICING.monthly.amountUsd}/mo)
                </button>
              </form>
              <form action={upgradeAnnual}>
                <button
                  type="submit"
                  disabled={Boolean(configError)}
                  className="w-full rounded-xl border border-white/40 p-3 text-sm font-medium hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Upgrade to Pro — Annual (${PRO_PRICING.annual.amountUsd}/yr)
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
