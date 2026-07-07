import type { StoredHand } from "@/lib/localHandStore";
import { currentStreak } from "@/lib/leaderboard";
import { topLeaks } from "@/lib/engine/leakFinder";
import { loadProgress } from "@/lib/training";
import { computeSkillTree } from "@/lib/coach/skillTree";
import { computeAchievements, type AchievementsInput } from "@/lib/coach/achievements";
import { getRoadmap } from "@/lib/coach/roadmap";
import { getIqHistory } from "@/lib/coach/iq";
import { readJson, writeJson, dateKey } from "@/lib/coach/coachStorage";

/**
 * In-app notification center — every notification is recomputed fresh from data that's already
 * cheap to derive (leaderboard streak, leak finder, achievements), never stored as an event log.
 * Only *read/unread state* is persisted (see below), so this stays honest: a notification exists
 * exactly as long as the underlying fact is still true.
 */

export interface AppNotification {
  id: string;
  message: string;
  href: string;
  createdAt: number;
}

function toDateKey(timestamp: number | string): string {
  return new Date(Number(timestamp)).toISOString().slice(0, 10);
}

function startOfDayMs(key: string): number {
  return new Date(`${key}T00:00:00.000Z`).getTime();
}

/** Monday-start ISO week bucket, same convention as leakFinder.ts's bucketKey. */
function isoWeekKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  return monday.toISOString().slice(0, 10);
}

/** Mirrors src/app/(app)/leaks/page.tsx's local severityStars() so the notification and the
 *  leaks page agree on what "high severity" means for the same underlying badDecisionRate. */
function severityStars(badDecisionRate: number): number {
  return Math.min(5, Math.max(1, Math.round(badDecisionRate * 5)));
}
const HIGH_SEVERITY_STARS = 4;

const STREAK_MILESTONES = [30, 14, 7, 3];

function noHandsTodayNotification(hands: StoredHand[]): AppNotification | null {
  if (hands.length === 0) return null;
  const mostRecent = hands.reduce((latest, h) => (Number(h.timestamp) > Number(latest.timestamp) ? h : latest));
  const today = dateKey();
  if (toDateKey(mostRecent.timestamp) === today) return null;
  return {
    id: `no-hands-today-${today}`,
    message: "לא ניתחת אף יד היום",
    href: "/analyze",
    createdAt: startOfDayMs(today),
  };
}

function streakMilestoneNotification(hands: StoredHand[]): AppNotification | null {
  const streak = currentStreak(hands);
  const milestone = STREAK_MILESTONES.find((m) => streak >= m);
  if (!milestone) return null;
  return {
    id: `streak-milestone-${milestone}`,
    message: `השגת רצף של ${milestone} ימים`,
    href: "/",
    createdAt: Date.now(),
  };
}

/** Builds the same AchievementsInput src/app/(app)/missions/page.tsx does (loadProgress +
 *  computeSkillTree + getRoadmap + getIqHistory), so "unlocked" here means the same thing it
 *  means on the achievements gallery — never a separately-invented definition. */
function achievementNotifications(hands: StoredHand[]): AppNotification[] {
  const trainingProgress = loadProgress();
  const skillTree = computeSkillTree(hands, trainingProgress);
  const input: AchievementsInput = {
    hands,
    trainingProgress,
    iqHistory: getIqHistory(),
    roadmap: getRoadmap(),
    skillTree,
  };
  return computeAchievements(input)
    .filter((a) => a.earned)
    .map((a) => ({
      id: `achievement-${a.id}`,
      message: `נפתח הישג חדש: ${a.label}`,
      href: "/missions",
      createdAt: Date.now(),
    }));
}

/** Fires once per calendar week that has >=1 new hand: the notification's id is keyed by the
 *  ISO week, so it naturally stops reappearing once read and naturally reappears next week if
 *  there's new data — no separate "last shown" flag needed beyond the read-ids store below. */
function weeklyReportNotification(hands: StoredHand[]): AppNotification | null {
  if (hands.length === 0) return null;
  const oldest = hands.reduce((min, h) => (Number(h.timestamp) < Number(min.timestamp) ? h : min));
  const oldestAgeMs = Date.now() - Number(oldest.timestamp);
  if (oldestAgeMs < 7 * 24 * 60 * 60 * 1000) return null;
  const thisWeekKey = isoWeekKey(Date.now());
  const hasNewDataThisWeek = hands.some((h) => isoWeekKey(Number(h.timestamp)) === thisWeekKey);
  if (!hasNewDataThisWeek) return null;
  return {
    id: `weekly-review-${thisWeekKey}`,
    message: "הדוח השבועי שלך מוכן",
    href: "/weekly-review",
    createdAt: new Date(`${thisWeekKey}T00:00:00.000Z`).getTime(),
  };
}

/** Uses the same topLeaks() the /leaks page and dashboard use, and the same severity-star
 *  threshold the /leaks page uses, so "high severity" is a single shared definition. */
function highSeverityLeakNotification(hands: StoredHand[]): AppNotification | null {
  const [leak] = topLeaks(hands, 1);
  if (!leak) return null;
  if (severityStars(leak.badDecisionRate) < HIGH_SEVERITY_STARS) return null;
  return {
    id: `leak-severity-${leak.dimension}-${leak.key}`,
    message: "זוהתה דליפה חדשה ברמת חומרה גבוהה",
    href: "/leaks",
    createdAt: Date.now(),
  };
}

export function computeNotifications(hands: StoredHand[]): AppNotification[] {
  const items: Array<AppNotification | null> = [
    highSeverityLeakNotification(hands),
    streakMilestoneNotification(hands),
    weeklyReportNotification(hands),
    noHandsTodayNotification(hands),
    ...achievementNotifications(hands),
  ];
  return items.filter((n): n is AppNotification => n !== null);
}

// ---------------------------------------------------------------------------
// Read/unread state (localStorage) — notifications themselves are never persisted, only which
// ids the user has already seen, capped so this can't grow unbounded.
// ---------------------------------------------------------------------------

const READ_IDS_KEY = "pra:notifications:read:v1";
const MAX_READ_IDS = 200;

export function getReadIds(): string[] {
  return readJson<string[]>(READ_IDS_KEY, []);
}

export function markAllRead(ids: string[]): void {
  if (ids.length === 0) return;
  const merged = [...getReadIds().filter((id) => !ids.includes(id)), ...ids];
  writeJson(READ_IDS_KEY, merged.slice(-MAX_READ_IDS));
}

export function unreadNotifications(notifications: AppNotification[]): AppNotification[] {
  const readIds = new Set(getReadIds());
  return notifications.filter((n) => !readIds.has(n.id));
}
