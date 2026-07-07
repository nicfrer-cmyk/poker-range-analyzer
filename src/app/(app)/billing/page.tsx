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
      errorMessage = body.error ?? `התשלום נכשל (קוד ${res.status}).`;
    }
  } catch {
    errorMessage = "אירעה שגיאה לא צפויה בעת פתיחת התשלום.";
  }

  if (successUrl) {
    redirect(successUrl);
  }
  redirect(`/billing?checkout=error&message=${encodeURIComponent(errorMessage ?? "התשלום נכשל.")}`);
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
      <h1 className="mb-2 text-2xl font-semibold">מנוי וחיוב</h1>
      <p className="mb-6 text-sm opacity-75">
        מנתח טווחי פוקר — תוכנית חינמית מול פרו.
      </p>

      {configError && (
        <div className="mb-6 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
          Supabase עדיין לא מוגדר, ולכן לא ניתן להציג את החשבון שלך או לבצע
          תשלום. ({configError})
        </div>
      )}

      {checkoutError && (
        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          {checkoutError}
        </div>
      )}
      {checkoutCancelled && (
        <div className="mb-6 rounded-2xl border border-white/20 bg-white/5 p-4 text-sm">
          התשלום בוטל — לא בוצע שום שינוי.
        </div>
      )}
      {checkoutSuccess && (
        <div className="mb-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-4 text-sm">
          תודה! המנוי שלך בתהליך הקמה — הדף הזה יציג גישת פרו ברגע ש-Stripe
          יאשר את התשלום.
        </div>
      )}

      {subscription && (
        <div className="mb-8 rounded-2xl border border-white/20 p-4 text-sm">
          מחובר בתור <span className="font-medium">{email}</span> — תוכנית
          נוכחית: <span className="font-medium">{subscription.plan}</span> (
          {subscription.status}
          {subscription.currentPeriodEnd
            ? `, מתחדש בתאריך ${subscription.currentPeriodEnd.toLocaleDateString("he-IL")}`
            : ""}
          )
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Free plan */}
        <div className="rounded-2xl border border-white/20 p-6">
          <h2 className="text-lg font-semibold">חינמי</h2>
          <p className="mt-1 text-3xl font-bold">$0</p>
          <ul className="mt-4 space-y-2 text-sm opacity-90">
            <li>{PLAN_LIMITS.FREE.dailyAnalysisLimit} ניתוחי ידיים ביום</li>
            <li>עד {PLAN_LIMITS.FREE.maxSavedHands} ניתוחים שמורים</li>
            <li>טווחים מוגדרים מראש + בנייה ידנית בסיסית של טווחים</li>
            <li>סיכום יד + מאמן</li>
            <li>חישובי פוט אודס / SPR / EV</li>
            <li>{PLAN_LIMITS.FREE.dailyImportLimit} ייבואי היסטוריית יד ביום (ללא ייבוא מרובה)</li>
            <li className="opacity-60">גילוי דליפות וסקירת סשן — לא כלול</li>
            <li>מצב אימון בסיסי</li>
            <li className="opacity-60">טווח מול טווח — לא כלול</li>
            <li className="opacity-60">מחשבון ICM — לא כלול</li>
            <li>{PLAN_LIMITS.FREE.dailyAiReviewLimit} ניתוחי AI ליד ביום</li>
            <li>עד {PLAN_LIMITS.FREE.maxOpponentProfiles} פרופילי יריבים</li>
            <li className="opacity-60">ייצוא נתונים — לא כלול</li>
            <li>תמיכה רגילה</li>
          </ul>
        </div>

        {/* Pro plan */}
        <div className="rounded-2xl border border-white/40 p-6">
          <h2 className="text-lg font-semibold">פרו</h2>
          <p className="mt-1 text-3xl font-bold">
            ${PRO_PRICING.monthly.amountUsd}
            <span className="text-base font-normal opacity-70">/לחודש</span>
          </p>
          <p className="text-xs opacity-60">
            או ${PRO_PRICING.annual.amountUsd}/לשנה (הנחה של{" "}
            {PRO_PRICING.annual.discountPercentVsMonthly}%) — מחיר זמני, בהמתנה
            למחקר שוק
          </p>
          <ul className="mt-4 space-y-2 text-sm opacity-90">
            <li>ניתוחי ידיים ללא הגבלה</li>
            <li>ניתוחים שמורים ללא הגבלה</li>
            <li>בניית טווחים מתקדמת עם שמירה ללא הגבלה</li>
            <li>ייבוא היסטוריית יד ללא הגבלה, כולל ייבוא מרובה</li>
            <li>גילוי דליפות וסקירת סשן מלאים</li>
            <li>מצב אימון מלא ומסלולי לימוד</li>
            <li>ניתוח טווח מול טווח</li>
            <li>מחשבון ICM</li>
            <li>ניתוחי AI ליד ללא הגבלה</li>
            <li>פרופילי יריבים ללא הגבלה</li>
            <li>ייצוא נתונים</li>
            <li>תמיכה מועדפת</li>
          </ul>

          {subscription?.plan === "PRO" ? (
            <div className="mt-6 rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-center text-sm">
              יש לך מנוי פרו פעיל
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              <form action={upgradeMonthly}>
                <button
                  type="submit"
                  disabled={Boolean(configError)}
                  className="w-full rounded-xl border border-white/40 p-3 text-sm font-medium hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  שדרוג לפרו — חודשי (${PRO_PRICING.monthly.amountUsd}/לחודש)
                </button>
              </form>
              <form action={upgradeAnnual}>
                <button
                  type="submit"
                  disabled={Boolean(configError)}
                  className="w-full rounded-xl border border-white/40 p-3 text-sm font-medium hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  שדרוג לפרו — שנתי (${PRO_PRICING.annual.amountUsd}/לשנה)
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
