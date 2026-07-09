// ---------------------------------------------------------------------------
// Plan gating — Free vs Pro limits
//
// Single source of truth for what each plan is allowed to do. Keep this in
// sync with the `Plan` enum in `prisma/schema.prisma` (FREE | PRO) and with
// the pricing shown on `src/app/billing/page.tsx`.
//
// "Unlimited" convention: this file uses the sentinel value `-1` for every
// unlimited *limit* field (e.g. `dailyAnalysisLimit: -1`), not `Infinity`.
// Reasons: `-1` survives JSON.stringify/parse and Prisma `Json` columns
// unchanged, while `Infinity` serializes to `null` and silently breaks
// comparisons after a round-trip through an API response or the database.
// Always compare via the `isUnlimited()` / `hasReachedLimit()` helpers below
// rather than checking `=== -1` inline, so the convention only has to be
// understood in one place.
// ---------------------------------------------------------------------------

export type Plan = "FREE" | "PRO";

export interface PlanLimits {
  /** Advanced (5-step wizard) hand analyses a user can run per day. -1 = unlimited. */
  dailyAnalysisLimit: number;
  /** Quick Analysis (hero cards + flop, no villain range) runs a user can do per day. -1 = unlimited. */
  dailyQuickAnalysisLimit: number;
  /** Total saved hand analyses a user may keep. -1 = unlimited. */
  maxSavedHands: number;
  /** Hand history imports per day. -1 = unlimited. */
  dailyImportLimit: number;
  /** Whether bulk (multi-file / multi-hand) import is allowed at all. */
  bulkImportAllowed: boolean;
  /**
   * Whether the leak finder shows its FULL breakdown (detailed leak list — severity, trend,
   * example hands). Free always sees a teaser (KPI row + street heat-map); this flag only
   * controls whether the deep-dive list unlocks, not whether the page itself is reachable.
   */
  leakFinderEnabled: boolean;
  /**
   * Whether the weekly report shows its FULL breakdown (improved/needs-work lists + next-week
   * goals). Free always sees the summary line and top-line KPIs; this flag only controls
   * whether the deep-dive sections unlock, not whether the page itself is reachable.
   */
  weeklyReportFullEnabled: boolean;
  /** Range-vs-range analysis — Pro-only feature. */
  rangeVsRangeEnabled: boolean;
  /** ICM calculator — Pro-only feature. */
  icmEnabled: boolean;
  /** AI hand reviews per day. -1 = unlimited. */
  dailyAiReviewLimit: number;
  /** Opponent profiles a user may save. -1 = unlimited. */
  maxOpponentProfiles: number;
  /** Whether exporting saved data (CSV/JSON) is allowed. */
  dataExportEnabled: boolean;
  /** Whether training mode includes the full track library, not just basics. */
  advancedTrainingModeEnabled: boolean;
  /** Priority support queue vs regular support. */
  prioritySupport: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    dailyAnalysisLimit: 3,
    dailyQuickAnalysisLimit: 3,
    // maxSavedHands and maxOpponentProfiles are also enforced at the DB level (defense-in-depth
    // against a direct write, not just this app's own UI/routes) by BEFORE INSERT triggers in
    // prisma/migrations/20260709130000_free_plan_db_quotas — those triggers hardcode the same
    // 25 / 3 values with no shared source of truth, so update both places if either changes.
    maxSavedHands: 25,
    dailyImportLimit: 5,
    bulkImportAllowed: false,
    // Policy reversal: leak finder's full breakdown and the full weekly report are now Pro
    // differentiators (were previously fully open on Free). Free still gets a teaser view of
    // each — see the field docs on `PlanLimits` above and the page-level gating in
    // `leaks/page.tsx` / `weekly-review/page.tsx`.
    leakFinderEnabled: false,
    weeklyReportFullEnabled: false,
    rangeVsRangeEnabled: false,
    icmEnabled: false,
    dailyAiReviewLimit: 1,
    maxOpponentProfiles: 3,
    dataExportEnabled: false,
    advancedTrainingModeEnabled: false,
    prioritySupport: false,
  },
  PRO: {
    dailyAnalysisLimit: -1,
    dailyQuickAnalysisLimit: -1,
    maxSavedHands: -1,
    dailyImportLimit: -1,
    bulkImportAllowed: true,
    leakFinderEnabled: true,
    weeklyReportFullEnabled: true,
    rangeVsRangeEnabled: true,
    icmEnabled: true,
    dailyAiReviewLimit: -1,
    maxOpponentProfiles: -1,
    dataExportEnabled: true,
    advancedTrainingModeEnabled: true,
    prioritySupport: true,
  },
};

/** Returns the limits table for a given plan. */
export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/** `-1` is this module's sentinel for "no limit" — see the file header. */
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

/** True once `current` usage has met or exceeded a (possibly unlimited) limit. */
export function hasReachedLimit(current: number, limit: number): boolean {
  if (isUnlimited(limit)) return false;
  return current >= limit;
}

/**
 * Actions that are gated by plan. Usage-based actions (e.g. `runAnalysis`)
 * are checked against a numeric limit + `currentUsage`; boolean-feature
 * actions (e.g. `useIcmCalculator`) ignore `currentUsage` entirely.
 */
export type PlanAction =
  | "runAnalysis"
  | "runQuickAnalysis"
  | "saveHand"
  | "importHand"
  | "bulkImportHands"
  | "useLeakFinder"
  | "viewFullWeeklyReport"
  | "useRangeVsRange"
  | "useIcmCalculator"
  | "runAiReview"
  | "addOpponentProfile"
  | "exportData";

export interface PlanCheckResult {
  allowed: boolean;
  /** Human-readable explanation, present whenever `allowed` is false. */
  reason?: string;
  /** True if the only way to unlock this action is upgrading to Pro. */
  upgradeRequired?: boolean;
}

const ALLOWED: PlanCheckResult = { allowed: true };

/**
 * Checks whether a user on `plan` may perform `action` right now.
 *
 * `currentUsage` is the count *before* this action would be performed (e.g.
 * "how many analyses has this user already run today", "how many hands are
 * already saved", "how many opponent profiles already exist"). It's ignored
 * for boolean-feature actions.
 */
export function canPerformAction(
  plan: Plan,
  action: PlanAction,
  currentUsage = 0
): PlanCheckResult {
  const limits = getPlanLimits(plan);

  switch (action) {
    case "runAnalysis":
      return checkLimit(
        currentUsage,
        limits.dailyAnalysisLimit,
        "הגעת למגבלת הניתוחים המתקדמים היומית בתוכנית החינמית."
      );

    case "runQuickAnalysis":
      return checkLimit(
        currentUsage,
        limits.dailyQuickAnalysisLimit,
        "הגעת למגבלת הניתוחים המהירים היומית בתוכנית החינמית."
      );

    case "saveHand":
      return checkLimit(
        currentUsage,
        limits.maxSavedHands,
        "לא ניתן לשמור עוד ידיים בתוכנית החינמית."
      );

    case "importHand":
      return checkLimit(
        currentUsage,
        limits.dailyImportLimit,
        "הגעת למגבלת הייבוא היומית בתוכנית החינמית."
      );

    case "bulkImportHands":
      return checkFeature(
        limits.bulkImportAllowed,
        "ייבוא מרובה זמין רק במנוי פרו."
      );

    case "useLeakFinder":
      return checkFeature(
        limits.leakFinderEnabled,
        "גילוי הדליפות המלא זמין רק במנוי פרו."
      );

    case "viewFullWeeklyReport":
      return checkFeature(
        limits.weeklyReportFullEnabled,
        "הדוח השבועי המלא זמין רק במנוי פרו."
      );

    case "useRangeVsRange":
      return checkFeature(
        limits.rangeVsRangeEnabled,
        "ניתוח טווח מול טווח זמין רק במנוי פרו."
      );

    case "useIcmCalculator":
      return checkFeature(
        limits.icmEnabled,
        "מחשבון ה-ICM זמין רק במנוי פרו."
      );

    case "runAiReview":
      return checkLimit(
        currentUsage,
        limits.dailyAiReviewLimit,
        "הגעת למגבלת ניתוחי ה-AI היומית בתוכנית החינמית."
      );

    case "addOpponentProfile":
      return checkLimit(
        currentUsage,
        limits.maxOpponentProfiles,
        "הגעת למגבלת פרופילי היריבים בתוכנית החינמית."
      );

    case "exportData":
      return checkFeature(
        limits.dataExportEnabled,
        "ייצוא נתונים זמין רק במנוי פרו."
      );

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

function checkLimit(
  currentUsage: number,
  limit: number,
  reason: string
): PlanCheckResult {
  if (!hasReachedLimit(currentUsage, limit)) return ALLOWED;
  return { allowed: false, reason, upgradeRequired: true };
}

function checkFeature(enabled: boolean, reason: string): PlanCheckResult {
  if (enabled) return ALLOWED;
  return { allowed: false, reason, upgradeRequired: true };
}

/**
 * Returns the numeric daily/count limit backing a usage-based `PlanAction`, or
 * `undefined` for boolean-feature actions (which have no "near the limit"
 * concept). Kept separate from `canPerformAction`'s switch so `isNearLimit`
 * doesn't have to duplicate its branching.
 */
function usageLimitFor(action: PlanAction, limits: PlanLimits): number | undefined {
  switch (action) {
    case "runAnalysis":
      return limits.dailyAnalysisLimit;
    case "runQuickAnalysis":
      return limits.dailyQuickAnalysisLimit;
    case "saveHand":
      return limits.maxSavedHands;
    case "importHand":
      return limits.dailyImportLimit;
    case "runAiReview":
      return limits.dailyAiReviewLimit;
    case "addOpponentProfile":
      return limits.maxOpponentProfiles;
    case "bulkImportHands":
    case "useLeakFinder":
    case "viewFullWeeklyReport":
    case "useRangeVsRange":
    case "useIcmCalculator":
    case "exportData":
      return undefined;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/**
 * True when a user is exactly one action away from hitting a usage-based
 * limit (e.g. `currentUsage === limit - 1`), so the UI can show a gentle
 * "almost there" warning before the hard block from `canPerformAction` kicks
 * in. Always `false` for unlimited plans and for boolean-feature actions
 * (`useIcmCalculator`, `exportData`, etc.) — those are all-or-nothing, not
 * usage-counted, so "near the limit" doesn't apply to them.
 */
export function isNearLimit(
  plan: Plan,
  action: PlanAction,
  currentUsage: number
): boolean {
  const limit = usageLimitFor(action, getPlanLimits(plan));
  if (limit === undefined || isUnlimited(limit)) return false;
  return currentUsage === limit - 1;
}
