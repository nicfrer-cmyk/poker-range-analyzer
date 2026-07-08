import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, isUnlimited, type Plan } from "@/lib/plan";

// ---------------------------------------------------------------------------
// Real, server-side enforcement of `dailyAiReviewLimit` (src/lib/plan.ts).
//
// `src/lib/usageTracker.ts` (localStorage) only drives the client-side UI —
// it's trivially bypassed by a signed-in user calling the API routes
// directly. This is the actual gate: it reads the user's real `users.plan`
// (the same column the Stripe webhook writes), atomically increments an
// on-disk daily counter, and rejects once that counter exceeds the plan's
// limit. Both `/api/ai/hand-review` and `/api/ai/parse-screenshot` share one
// counter (`ai_usage_daily`) since both spend the same Anthropic budget.
// ---------------------------------------------------------------------------

function todayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export interface AiQuotaResult {
  allowed: boolean;
  /** Present whenever `allowed` is false. */
  reason?: string;
}

const QUOTA_REASON = "הגעת למגבלת ניתוחי ה-AI היומית בתוכנית החינמית. שדרג לפרו להמשך שימוש היום.";

/**
 * Atomically increments today's AI-usage count for `userId` and checks the result against
 * their real plan's `dailyAiReviewLimit`. Pro (unlimited) users skip the write entirely.
 * Call this once per request, after auth and before the paid Anthropic call — never after.
 */
export async function checkAndIncrementAiQuota(userId: string): Promise<AiQuotaResult> {
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  const plan: Plan = dbUser?.plan ?? "FREE";
  const limit = PLAN_LIMITS[plan].dailyAiReviewLimit;

  if (isUnlimited(limit)) return { allowed: true };

  const usage = await prisma.aiUsageDaily.upsert({
    where: { userId_usageDate: { userId, usageDate: todayUtcDate() } },
    create: { userId, usageDate: todayUtcDate(), count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  if (usage.count > limit) {
    return { allowed: false, reason: QUOTA_REASON };
  }
  return { allowed: true };
}
