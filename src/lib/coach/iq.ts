import type { StoredHand } from "@/lib/localHandStore";
import { computeSessionStats } from "@/lib/engine/leakFinder";
import { currentStreak } from "@/lib/leaderboard";
import type { TrainingProgress } from "@/lib/training";
import type { SkillTreeResult } from "@/lib/coach/skillTree";
import { dateKey, readJson, writeJson } from "@/lib/coach/coachStorage";

/**
 * Poker IQ — a single 0-1000 headline score blending four real signals so it reads as a
 * meaningful summary rather than a made-up number:
 *  - decision quality on saved hands (leak finder's goodDecisionRate)
 *  - training-quiz mastery (training.ts's cumulative accuracy)
 *  - skill-tree coverage (average domain mastery, computed from the same hand data)
 *  - consistency (the existing leaderboard streak concept)
 */

export interface IqBreakdownItem {
  id: "decisionQuality" | "trainingMastery" | "skillCoverage" | "consistency";
  label: string;
  points: number;
  maxPoints: number;
}

export interface PokerIqResult {
  score: number;
  breakdown: IqBreakdownItem[];
}

const MAX_DECISION_QUALITY = 400;
const MAX_TRAINING_MASTERY = 300;
const MAX_SKILL_COVERAGE = 200;
const MAX_CONSISTENCY = 100;
const TRAINING_FULL_CREDIT_SAMPLE = 10;
const STREAK_FULL_CREDIT_DAYS = 30;

export function computePokerIQ(
  hands: StoredHand[],
  trainingProgress: TrainingProgress,
  skillTree: SkillTreeResult
): PokerIqResult {
  const stats = computeSessionStats(hands);
  const decisionQuality = hands.length > 0 ? Math.round(stats.goodDecisionRate * MAX_DECISION_QUALITY) : 0;

  const trainingSampleCredit = Math.min(1, trainingProgress.totalAnswered / TRAINING_FULL_CREDIT_SAMPLE);
  const trainingAccuracy = trainingProgress.totalAnswered > 0 ? trainingProgress.totalCorrect / trainingProgress.totalAnswered : 0;
  const trainingMastery = Math.round(trainingAccuracy * trainingSampleCredit * MAX_TRAINING_MASTERY);

  const domainsWithData = skillTree.domains.filter((d) => d.masteryPct !== null);
  const avgMastery = domainsWithData.length > 0
    ? domainsWithData.reduce((sum, d) => sum + (d.masteryPct as number), 0) / domainsWithData.length
    : 0;
  const skillCoverage = Math.round((avgMastery / 100) * MAX_SKILL_COVERAGE);

  const consistency = Math.round(Math.min(1, currentStreak(hands) / STREAK_FULL_CREDIT_DAYS) * MAX_CONSISTENCY);

  const score = decisionQuality + trainingMastery + skillCoverage + consistency;

  return {
    score,
    breakdown: [
      { id: "decisionQuality", label: "איכות החלטות בידיים שנותחו", points: decisionQuality, maxPoints: MAX_DECISION_QUALITY },
      { id: "trainingMastery", label: "שליטה באימון", points: trainingMastery, maxPoints: MAX_TRAINING_MASTERY },
      { id: "skillCoverage", label: "כיסוי עץ המיומנויות", points: skillCoverage, maxPoints: MAX_SKILL_COVERAGE },
      { id: "consistency", label: "עקביות (רצף ימים פעילים)", points: consistency, maxPoints: MAX_CONSISTENCY },
    ],
  };
}

// ---------------------------------------------------------------------------
// History — one snapshot/day, so the weekly delta and progress graph are real.
// ---------------------------------------------------------------------------

export interface IqSnapshot {
  date: string; // YYYY-MM-DD
  score: number;
}

const IQ_HISTORY_KEY = "pra:coach:iqHistory:v1";
const MAX_HISTORY_ENTRIES = 90;

export function getIqHistory(): IqSnapshot[] {
  return readJson<IqSnapshot[]>(IQ_HISTORY_KEY, []).sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Records today's score once per calendar day (overwriting an earlier snapshot from today so
 *  refreshing the page repeatedly doesn't spam the history with duplicate same-day entries). */
export function recordIqSnapshotIfNeeded(score: number): void {
  const today = dateKey();
  const history = readJson<IqSnapshot[]>(IQ_HISTORY_KEY, []);
  const withoutToday = history.filter((s) => s.date !== today);
  const next = [...withoutToday, { date: today, score }]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-MAX_HISTORY_ENTRIES);
  writeJson(IQ_HISTORY_KEY, next);
}

/** Delta vs. the closest snapshot at least 7 days old. Returns null when there isn't a week of
 *  history yet, so the UI can show an honest "not enough history yet" instead of a fake number. */
export function getWeeklyDelta(history: IqSnapshot[], currentScore: number): number | null {
  if (history.length === 0) return null;
  const cutoff = dateKey(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const candidates = history.filter((s) => s.date <= cutoff);
  if (candidates.length === 0) return null;
  const reference = candidates[candidates.length - 1] as IqSnapshot;
  return currentScore - reference.score;
}
