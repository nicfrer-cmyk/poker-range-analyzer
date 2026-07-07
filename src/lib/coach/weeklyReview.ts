import type { StoredHand } from "@/lib/localHandStore";
import { topLeaks, progressForLeak, type TopLeak } from "@/lib/engine/leakFinder";
import { weekStats } from "@/lib/leaderboard";
import { formatLeakKey, LEAK_DIMENSION_LABEL } from "@/lib/labels";

/**
 * Weekly Review — a templated (non-AI) Hebrew report built from the same leak-finder data as
 * the rest of the coach, in the same honest, no-overpromising style as SessionDashboard's
 * `leakAdvice`. No LLM call needed: everything here is derived, reproducible, and free.
 */

export type TrendDirection = "improving" | "worsening" | "flat" | "unknown";

export interface WeeklyLeakTrend {
  leak: TopLeak;
  trendDirection: TrendDirection;
}

export interface WeeklyReview {
  weekHandCount: number;
  weekAccuracyPct: number;
  repeatedMistakes: TopLeak[];
  improved: WeeklyLeakTrend[];
  needsWork: WeeklyLeakTrend[];
  goalsNextWeek: string[];
  summaryHe: string;
  /** Poker IQ movement over the last 7 days (iq.ts's getWeeklyDelta) — null when there isn't a
   *  week of IQ history yet, or when the caller doesn't pass one in (e.g. no TrainingProgress
   *  available yet). Folded into the headline summary so the weekly report genuinely reflects
   *  IQ movement, not just this week's hand count. */
  iqWeeklyDelta: number | null;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Also used by the /leaks page to show a per-leak improving/worsening indicator. */
export function trendFor(hands: StoredHand[], leak: TopLeak): TrendDirection {
  const series = progressForLeak(hands, leak, "week");
  if (series.length < 2) return "unknown";
  const last = series[series.length - 1]!;
  const prev = series[series.length - 2]!;
  const delta = last.badDecisionRate - prev.badDecisionRate;
  if (delta < -0.05) return "improving";
  if (delta > 0.05) return "worsening";
  return "flat";
}

function goalFor(trend: WeeklyLeakTrend): string {
  const label = formatLeakKey(trend.leak.dimension, trend.leak.key);
  const dimLabel = LEAK_DIMENSION_LABEL[trend.leak.dimension] ?? trend.leak.dimension;
  return `המשך לתרגל ${dimLabel}: ${label} — זה עדיין תחום שדורש תשומת לב בשבוע הקרוב.`;
}

/** `iqWeeklyDelta` is optional (computed by the caller via iq.ts's getWeeklyDelta, the same
 *  function the dashboard/IQ page already use for "change vs. last week") so this stays a pure
 *  function of its inputs instead of reaching into TrainingProgress/SkillTree itself. */
export function buildWeeklyReview(hands: StoredHand[], iqWeeklyDelta: number | null = null): WeeklyReview {
  const weekHands = hands.filter((h) => Number(h.timestamp) >= Date.now() - WEEK_MS);
  const week = weekStats(hands);
  const repeatedMistakes = topLeaks(weekHands, 3);

  const trends: WeeklyLeakTrend[] = repeatedMistakes.map((leak) => ({
    leak,
    trendDirection: trendFor(hands, leak),
  }));
  const improved = trends.filter((t) => t.trendDirection === "improving");
  const needsWork = trends.filter((t) => t.trendDirection !== "improving");

  const goalsNextWeek =
    needsWork.length > 0
      ? needsWork.map(goalFor)
      : ["לא זוהו דליפות בולטות השבוע — המשך לשמור ידיים כדי לקבל יעדים מדויקים יותר."];

  const topLeakLabel = repeatedMistakes[0]
    ? formatLeakKey(repeatedMistakes[0].dimension, repeatedMistakes[0].key)
    : null;

  const iqSentence =
    iqWeeklyDelta === null
      ? ""
      : iqWeeklyDelta === 0
        ? " ה-Poker IQ שלך נשאר יציב השבוע."
        : ` ה-Poker IQ שלך ${iqWeeklyDelta > 0 ? "עלה" : "ירד"} ב-${Math.abs(iqWeeklyDelta)} נקודות השבוע.`;

  const summaryHe =
    weekHands.length === 0
      ? "לא נשמרו ידיים בשבוע האחרון — נתח כמה ידיים כדי לקבל סיכום שבועי אמיתי."
      : `השבוע ניתחת ${weekHands.length} ידיים בדיוק החלטות של כ-${Math.round(week.accuracyPct)}%.` +
        (topLeakLabel
          ? ` הדפוס הבולט ביותר לשיפור היה ${topLeakLabel}${improved.some((t) => formatLeakKey(t.leak.dimension, t.leak.key) === topLeakLabel) ? ", ורואים שיפור לאורך השבוע." : "."}`
          : " לא זוהתה דליפה בולטת אחת — המשך כך.") +
        iqSentence +
        " המשך להתמקד ביעדים לשבוע הקרוב מטה.";

  return {
    weekHandCount: weekHands.length,
    weekAccuracyPct: week.accuracyPct,
    repeatedMistakes,
    improved,
    needsWork,
    goalsNextWeek,
    summaryHe,
    iqWeeklyDelta,
  };
}
