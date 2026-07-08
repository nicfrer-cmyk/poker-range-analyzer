// ---------------------------------------------------------------------------
// /billing — plan comparison + upgrade entry point
//
// Server Component. Shows Free vs Pro plan cards (driven by the limits table
// in `src/lib/plan.ts`) and, for a signed-in user, their current plan and
// subscription status (if a `Subscription` row exists).
//
// The "Upgrade to Pro" buttons are plain <form> submissions bound to a
// Server Action defined in this file, which itself POSTs to
// `/api/grow/checkout` (forwarding the user's auth cookie) and redirects
// the browser to the returned Grow payment-page URL — or back to this page
// with an error message on failure. This keeps the whole page a single
// Server Component with no separate client-side button component needed.
//
// Payment provider: Grow (decided 2026-07-07, replacing the Stripe
// scaffolding — see src/lib/stripe/* and src/app/api/stripe/*, kept in
// place but no longer the active path). The Grow checkout route is real
// plumbing against Grow's actual API; the webhook route is a deliberate
// stub until Grow's webhook-verification mechanism is confirmed — see
// src/app/api/grow/webhook/route.ts's header comment and ROADMAP.md.
//
// LOCAL-ONLY NOTE: with no real Grow merchant account connected yet, this
// page still renders (plan cards always show); the upgrade buttons will
// surface a clear inline error instead of crashing until GROW_USER_ID /
// GROW_PAGE_CODE_CREDIT_CARD are set — see `.env.example`.
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, type Plan } from "@/lib/plan";
import { PRO_PRICING_ILS, type BillingInterval } from "@/lib/grow/plans";
import { track } from "@/lib/analytics";

async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

/** Server Action: POSTs to our own checkout route, then redirects. */
async function upgradeToPro(interval: BillingInterval) {
  "use server";

  // Fires on every submit of either plan-card button — this Server Action is the only code that
  // runs when either "upgrade to pro" form is submitted, so it's the natural (if server-side)
  // stand-in for an onClick.
  track("upgrade_clicked", { source: "billing_page", interval });

  const cookieHeader = (await cookies())
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // Note: `redirect()` is intentionally called outside the try/catch below —
  // it works by throwing a special Next.js control-flow error, which a
  // surrounding catch block would otherwise swallow.
  let successUrl: string | undefined;
  let errorMessage: string | undefined;

  try {
    const res = await fetch(`${await getOrigin()}/api/grow/checkout`, {
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
    // "Checkout session created," not "payment actually completed" — that would require the
    // Grow webhook, which is a deliberate no-op stub until its verification mechanism is
    // confirmed (see src/app/api/grow/webhook/route.ts's header comment).
    track("subscription_started", { interval });
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
    const supabase = await createClient();
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

export default async function BillingPage(
  props: {
    searchParams: Promise<{ checkout?: string; message?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const { email, subscription, configError } = await getCurrentUserAndSubscription();

  const checkoutError =
    searchParams.checkout === "error" ? searchParams.message ?? "התשלום נכשל." : null;
  const checkoutCancelled = searchParams.checkout === "cancelled";
  const checkoutSuccess = searchParams.checkout === "success";

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">מנוי וחיוב</h1>
      <p className="mb-6 text-sm text-base-muted">
        מנתח טווחי פוקר — תוכנית חינמית מול פרו.
      </p>

      {configError && (
        <div className="mb-6 rounded-2xl border border-status-close/40 bg-status-close/10 p-4 text-sm text-base-text">
          Supabase עדיין לא מוגדר, ולכן לא ניתן להציג את החשבון שלך או לבצע
          תשלום. ({configError})
        </div>
      )}

      {checkoutError && (
        <div className="mb-6 rounded-2xl border border-status-behind/40 bg-status-behind/10 p-4 text-sm text-base-text">
          {checkoutError}
        </div>
      )}
      {checkoutCancelled && (
        <div className="mb-6 rounded-2xl border border-base-border bg-base-panel2 p-4 text-sm text-base-text">
          התשלום בוטל — לא בוצע שום שינוי.
        </div>
      )}
      {checkoutSuccess && (
        <div className="mb-6 rounded-2xl border border-status-crushing/40 bg-status-crushing/10 p-4 text-sm text-base-text">
          תודה! המנוי שלך בתהליך הקמה — הדף הזה יציג גישת פרו ברגע ש-Grow
          יאשר את התשלום.
        </div>
      )}

      {subscription && (
        <div className="mb-8 rounded-2xl border border-base-border bg-base-panel p-4 text-sm text-base-text">
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
        <div className="rounded-2xl border border-base-border bg-base-panel p-6">
          <h2 className="text-lg font-semibold">חינמי</h2>
          <p className="mt-1 text-3xl font-bold">₪0</p>
          <ul className="mt-4 space-y-2 text-sm text-base-text/90">
            <li>{PLAN_LIMITS.FREE.dailyQuickAnalysisLimit} ניתוחים מהירים ביום</li>
            <li>{PLAN_LIMITS.FREE.dailyAnalysisLimit} ניתוחים מתקדמים ביום</li>
            <li>עד {PLAN_LIMITS.FREE.maxSavedHands} ניתוחים שמורים</li>
            <li>טווחים מוגדרים מראש + בנייה ידנית בסיסית של טווחים, כולל חוקר טווחים (Range Explorer)</li>
            <li>סיכום יד + מאמן, עם צפייה חוזרת ביד (Hand Replay)</li>
            <li>חישובי פוט אודס / SPR / EV</li>
            <li>{PLAN_LIMITS.FREE.dailyImportLimit} ייבואי היסטוריית יד ביום (ללא ייבוא מרובה)</li>
            <li>
              מאמן אישי: גילוי דליפות, DNA פוקר, IQ פוקר, עץ מיומנויות, משימות יומיות, סקירה
              שבועית ומסלול 30 יום
            </li>
            <li>מצב אימון בסיסי</li>
            <li>השוואת ידיים, שיתוף, תגיות וחיפוש בספריית הידיים</li>
            <li>סיור היכרות והתראות באפליקציה</li>
            <li className="text-base-muted">טווח מול טווח — בקרוב, טרם הושק</li>
            <li className="text-base-muted">מחשבון ICM — בקרוב, טרם הושק</li>
            <li>{PLAN_LIMITS.FREE.dailyAiReviewLimit} ניתוחי AI ליד ביום</li>
            <li>עד {PLAN_LIMITS.FREE.maxOpponentProfiles} פרופילי יריבים</li>
            <li className="text-base-muted">ייצוא נתונים — לא כלול</li>
            <li>תמיכה רגילה</li>
          </ul>
        </div>

        {/* Pro plan */}
        <div className="rounded-2xl border border-accent/40 bg-base-panel p-6">
          <h2 className="text-lg font-semibold">פרו</h2>
          <p className="mt-1 text-3xl font-bold">
            ₪{PRO_PRICING_ILS.monthly.amountIls}
            <span className="text-base font-normal text-base-muted">/לחודש</span>
          </p>
          <p className="text-xs text-base-muted">
            או ₪{PRO_PRICING_ILS.annual.amountIls}/לשנה (הנחה של{" "}
            {PRO_PRICING_ILS.annual.discountPercentVsMonthly}%) — מחיר זמני, בהמתנה
            למחקר שוק
          </p>
          <ul className="mt-4 space-y-2 text-sm text-base-text/90">
            <li>ניתוחי ידיים ללא הגבלה</li>
            <li>ניתוחים שמורים ללא הגבלה</li>
            <li>בניית טווחים מתקדמת עם שמירה ללא הגבלה, כולל חוקר טווחים (Range Explorer)</li>
            <li>ייבוא היסטוריית יד ללא הגבלה, כולל ייבוא מרובה</li>
            <li>
              מאמן אישי מלא: גילוי דליפות, DNA פוקר, IQ פוקר, עץ מיומנויות, משימות יומיות, סקירה
              שבועית ומסלול 30 יום
            </li>
            <li>מצב אימון מלא ומסלולי לימוד</li>
            <li>צפייה חוזרת ביד, השוואת ידיים, שיתוף, תגיות וחיפוש מתקדם</li>
            <li className="text-base-muted">טווח מול טווח — בקרוב, טרם הושק (ללא תלות בתוכנית)</li>
            <li className="text-base-muted">מחשבון ICM — בקרוב, טרם הושק (ללא תלות בתוכנית)</li>
            <li>ניתוחי AI ליד ללא הגבלה</li>
            <li>פרופילי יריבים ללא הגבלה</li>
            <li>ייצוא נתונים</li>
            <li>תמיכה מועדפת</li>
          </ul>

          {subscription?.plan === "PRO" ? (
            <div className="mt-6 rounded-xl border border-status-crushing/40 bg-status-crushing/10 p-3 text-center text-sm text-base-text">
              יש לך מנוי פרו פעיל
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              <form action={upgradeMonthly}>
                <button
                  type="submit"
                  disabled={Boolean(configError)}
                  className="w-full rounded-xl border border-accent/40 p-3 text-sm font-medium text-base-text hover:bg-base-panel2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  שדרוג לפרו — חודשי (₪{PRO_PRICING_ILS.monthly.amountIls}/לחודש)
                </button>
              </form>
              <form action={upgradeAnnual}>
                <button
                  type="submit"
                  disabled={Boolean(configError)}
                  className="w-full rounded-xl border border-accent/40 p-3 text-sm font-medium text-base-text hover:bg-base-panel2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  שדרוג לפרו — שנתי (₪{PRO_PRICING_ILS.annual.amountIls}/לשנה)
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
