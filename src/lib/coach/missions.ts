import type { StoredHand } from "@/lib/localHandStore";
import { todayStats } from "@/lib/leaderboard";
import { topLeaks } from "@/lib/engine/leakFinder";
import { getTodayCount } from "@/lib/usageTracker";
import type { TrackId } from "@/lib/training";
import type { SkillTreeResult } from "@/lib/coach/skillTree";
import { dateKey, readJson, writeJson, seededRng } from "@/lib/coach/coachStorage";
import { getRoadmap, roadmapDayFor } from "@/lib/coach/roadmap";

/**
 * Daily Missions — a rotating set of 3 tasks/day, always derived from real activity (never a
 * manual "mark done" checkbox) and weighted toward the user's current weakest skill domain, so
 * the missions genuinely feel personalized rather than generic daily-challenge boilerplate.
 */

export interface Mission {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  unit: string;
  completed: boolean;
  xp: number;
}

const ANALYZE_TARGETS = [3, 5, 8];

function analyzeHandsMission(hands: StoredHand[], rng: () => number): Mission {
  const target = ANALYZE_TARGETS[Math.floor(rng() * ANALYZE_TARGETS.length)] as number;
  const progress = Math.min(target, todayStats(hands).handCount);
  return {
    id: "analyze-hands",
    title: `נתח ${target} ידיים היום`,
    description: "נתח או ייבא ידיים ל-/analyze או /hands/import.",
    target,
    progress,
    unit: "ידיים",
    completed: progress >= target,
    xp: 20,
  };
}

function trainingRepsMission(trackId: TrackId, trackLabel: string, rng: () => number): Mission {
  const target = rng() < 0.5 ? 5 : 10;
  const progress = Math.min(target, getTodayCount(`training:${trackId}`));
  return {
    id: `training-reps-${trackId}`,
    title: `השלם ${target} תרגולים בנושא ${trackLabel}`,
    description: "זה תחום שנראה שדורש הכי הרבה עבודה כרגע, לפי הידיים והאימונים שלך.",
    target,
    progress,
    unit: "תרגולים",
    completed: progress >= target,
    xp: 20,
  };
}

function trainingAccuracyMission(): Mission {
  const answered = getTodayCount("training:answered");
  const correct = getTodayCount("training:correct");
  const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const MIN_ANSWERED = 3;
  const target = 70;
  return {
    id: "training-accuracy",
    title: "שמור על דיוק 70%+ באימון היום",
    description: `נדרשות לפחות ${MIN_ANSWERED} תשובות היום כדי שהמשימה תיספר.`,
    target,
    progress: answered >= MIN_ANSWERED ? pct : 0,
    unit: "%",
    completed: answered >= MIN_ANSWERED && pct >= target,
    xp: 15,
  };
}

function reviewTopLeakMission(hands: StoredHand[]): Mission | null {
  const leak = topLeaks(hands, 1)[0];
  if (!leak) return null;
  const today = dateKey();
  const matchesToday = hands.filter((h) => dateKey(Number(h.timestamp)) === today).some((h) => leak.records.includes(h));
  return {
    id: "review-top-leak",
    title: "נתח יד מהדליפה המובילה שלך היום",
    description: "הדליפה המובילה שלך כרגע מבוססת על הידיים ששמרת — עוד יד מהקטגוריה הזו עוזרת למדוד שיפור.",
    target: 1,
    progress: matchesToday ? 1 : 0,
    unit: "ידיים",
    completed: matchesToday,
    xp: 15,
  };
}

function roadmapStepMission(hands: StoredHand[]): Mission | null {
  const roadmap = getRoadmap();
  if (!roadmap) return null;
  const day = roadmapDayFor(roadmap);
  if (!day) return null;
  const analyzedToday = todayStats(hands).handCount;
  const progress = Math.min(day.targetHands, analyzedToday);
  return {
    id: `roadmap-day-${day.day}`,
    title: `השלם את יום ${day.day} בתוכנית ה-30 יום`,
    description: day.goalText,
    target: day.targetHands,
    progress,
    unit: "ידיים",
    completed: progress >= day.targetHands,
    xp: 25,
  };
}

/** `skillTree` already folds in training-quiz accuracy (see skillTree.ts's trackAccuracy), so
 *  missions only need hands + the skill tree, not a separate TrainingProgress parameter. */
export function generateDailyMissions(hands: StoredHand[], skillTree: SkillTreeResult): Mission[] {
  const today = dateKey();
  const rng = seededRng(today);

  const weakestTrackId: TrackId = skillTree.weakestDomain?.recommendationTrackId ?? "preflop";
  const weakestLabel = skillTree.weakestDomain?.label ?? "פרה-פלופ";

  const anchors: Mission[] = [
    analyzeHandsMission(hands, rng),
    trainingRepsMission(weakestTrackId, weakestLabel, rng),
  ];

  const pool = [trainingAccuracyMission(), reviewTopLeakMission(hands), roadmapStepMission(hands)].filter(
    (m): m is Mission => m !== null
  );
  if (pool.length > 0) {
    const pick = pool[Math.floor(rng() * pool.length)] as Mission;
    anchors.push(pick);
  }

  return anchors;
}

// ---------------------------------------------------------------------------
// Coach XP — separate from leaderboard.ts's fully-derived `points`, since XP here is an
// additive reward for completing a day's missions rather than a live-recomputed stat.
// ---------------------------------------------------------------------------

interface CoachXpState {
  total: number;
  awardedDates: string[];
}

const XP_KEY = "pra:coach:xp:v1";

export function getCoachXp(): number {
  return readJson<CoachXpState>(XP_KEY, { total: 0, awardedDates: [] }).total;
}

/** Awards the day's mission XP once, the first time all of today's missions are completed. */
export function awardXpIfNewlyCompleted(missions: Mission[]): { xpAwardedNow: number; total: number } {
  const today = dateKey();
  const allComplete = missions.length > 0 && missions.every((m) => m.completed);
  const state = readJson<CoachXpState>(XP_KEY, { total: 0, awardedDates: [] });
  if (!allComplete || state.awardedDates.includes(today)) {
    return { xpAwardedNow: 0, total: state.total };
  }
  const earned = missions.reduce((sum, m) => sum + m.xp, 0);
  const next: CoachXpState = { total: state.total + earned, awardedDates: [...state.awardedDates, today] };
  writeJson(XP_KEY, next);
  return { xpAwardedNow: earned, total: next.total };
}
