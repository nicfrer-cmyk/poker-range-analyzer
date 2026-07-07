import type { StoredHand } from "@/lib/localHandStore";
import { isGoodDecision, progressSeries } from "@/lib/engine/leakFinder";

export interface PeriodStats {
  handCount: number;
  goodCount: number;
  accuracyPct: number;
  points: number;
}

function toDateKey(timestamp: number | string): string {
  return new Date(Number(timestamp)).toISOString().slice(0, 10);
}

function statsFor(records: StoredHand[]): PeriodStats {
  const handCount = records.length;
  const goodCount = records.filter(isGoodDecision).length;
  return {
    handCount,
    goodCount,
    accuracyPct: handCount > 0 ? (goodCount / handCount) * 100 : 0,
    points: goodCount * 10 + handCount * 2,
  };
}

/** Hands from today only (local calendar day). */
export function todayStats(records: StoredHand[]): PeriodStats {
  const today = toDateKey(Date.now());
  return statsFor(records.filter((r) => toDateKey(r.timestamp) === today));
}

/** Hands from the last 7 days. */
export function weekStats(records: StoredHand[]): PeriodStats {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return statsFor(records.filter((r) => Number(r.timestamp) >= cutoff));
}

/** Hands from the last 30 days. */
export function monthStats(records: StoredHand[]): PeriodStats {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return statsFor(records.filter((r) => Number(r.timestamp) >= cutoff));
}

export function allTimeStats(records: StoredHand[]): PeriodStats {
  return statsFor(records);
}

/** Consecutive calendar days (ending today or yesterday) with at least one saved hand. */
export function currentStreak(records: StoredHand[]): number {
  if (records.length === 0) return 0;
  const days = new Set(records.map((r) => toDateKey(r.timestamp)));
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to still count as "alive" if today has no hands yet but yesterday did.
  if (!days.has(toDateKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(toDateKey(cursor.getTime()))) return 0;
  }
  while (days.has(toDateKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  unit: string;
}

/** Personal daily/weekly/monthly challenges — computed locally from saved hands.
 *  Framed as personal goals rather than a real multiplayer leaderboard, since hand data is
 *  currently local-only per browser (see ROADMAP.md — real cross-user leaderboards need the
 *  Supabase data-layer swap). */
export function buildChallenges(records: StoredHand[]): Challenge[] {
  const today = todayStats(records);
  const week = weekStats(records);
  const month = monthStats(records);
  const streak = currentStreak(records);

  return [
    {
      id: "daily-hands",
      title: "אתגר יומי: 5 ידיים",
      description: "נתח והשלם 5 ידיים היום",
      target: 5,
      progress: Math.min(5, today.handCount),
      unit: "ידיים",
    },
    {
      id: "daily-accuracy",
      title: "אתגר יומי: דיוק 70%",
      description: "שמור על דיוק החלטות של 70% ומעלה היום",
      target: 70,
      progress: today.handCount > 0 ? Math.round(today.accuracyPct) : 0,
      unit: "%",
    },
    {
      id: "weekly-hands",
      title: "אתגר שבועי: 25 ידיים",
      description: "נתח 25 ידיים השבוע",
      target: 25,
      progress: Math.min(25, week.handCount),
      unit: "ידיים",
    },
    {
      id: "monthly-streak",
      title: "רצף חודשי",
      description: "כמה ימים ברצף ניתחת לפחות יד אחת",
      target: 30,
      progress: Math.min(30, streak),
      unit: "ימים",
    },
    {
      id: "monthly-hands",
      title: "אתגר חודשי: 100 ידיים",
      description: "נתח 100 ידיים החודש",
      target: 100,
      progress: Math.min(100, month.handCount),
      unit: "ידיים",
    },
  ];
}

export function accuracyTrend(records: StoredHand[], bucket: "day" | "week" = "day") {
  return progressSeries(records, bucket);
}
