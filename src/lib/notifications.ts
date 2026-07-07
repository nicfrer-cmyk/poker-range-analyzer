import type { StoredHand } from "@/lib/localHandStore";
import { currentStreak } from "@/lib/leaderboard";
import { topLeaks } from "@/lib/engine/leakFinder";
import { loadProgress } from "@/lib/training";
import { computeSkillTree, type SkillTreeResult } from "@/lib/coach/skillTree";
import { computeAchievements, type AchievementsInput } from "@/lib/coach/achievements";
import { getRoadmap } from "@/lib/coach/roadmap";
import { getIqHistory } from "@/lib/coach/iq";
import { readJson, writeJson, dateKey } from "@/lib/coach/coachStorage";
import { generateDailyMissions } from "@/lib/coach/missions";
import { buildWeeklyReview } from "@/lib/coach/weeklyReview";
import { formatLeakKey } from "@/lib/labels";
import { PLAN_LIMITS, isUnlimited, type Plan } from "@/lib/plan";

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

/** Takes the same AchievementsInput src/app/(app)/missions/page.tsx builds (loadProgress +
 *  computeSkillTree + getRoadmap + getIqHistory), so "unlocked" here means the same thing it
 *  means on the achievements gallery — never a separately-invented definition. Precomputed by
 *  the caller (computeNotifications) since missionReminderNotification needs the same
 *  trainingProgress/skillTree and recomputing them twice per check would be wasteful. */
function achievementNotifications(input: AchievementsInput): AppNotification[] {
  return computeAchievements(input)
    .filter((a) => a.earned)
    .map((a) => ({
      id: `achievement-${a.id}`,
      message: `נפתח הישג חדש: ${a.label}`,
      href: "/missions",
      createdAt: Date.now(),
    }));
}

/** Fires while at least one of today's daily missions (same generateDailyMissions() the
 *  /missions page uses) is still incomplete — id is keyed by day so it naturally disappears
 *  once all of today's missions are done and reappears fresh tomorrow. */
function missionReminderNotification(hands: StoredHand[], skillTree: SkillTreeResult): AppNotification | null {
  const missions = generateDailyMissions(hands, skillTree);
  const allCompleted = missions.length > 0 && missions.every((m) => m.completed);
  if (allCompleted) return null;
  const today = dateKey();
  return {
    id: `mission-reminder-${today}`,
    message: "יש לך משימת לימוד חדשה להיום",
    href: "/missions",
    createdAt: startOfDayMs(today),
  };
}

/** Free-plan usage nudge — fires once a FREE user has used most of today's daily analysis
 *  allowance (PLAN_LIMITS.FREE.dailyAnalysisLimit, read-only here). Always skipped for PRO
 *  (unlimited, no ceiling to nudge about) and skipped entirely when the caller doesn't supply
 *  plan/usage context (existing callers that haven't been updated yet). */
const USAGE_NUDGE_THRESHOLD = 0.8;

function usageNudgeNotification(plan: Plan, todayAnalysisCount: number): AppNotification | null {
  if (plan !== "FREE") return null;
  const limit = PLAN_LIMITS.FREE.dailyAnalysisLimit;
  if (isUnlimited(limit) || limit <= 0) return null;
  if (todayAnalysisCount / limit < USAGE_NUDGE_THRESHOLD) return null;
  const today = dateKey();
  return {
    id: `usage-nudge-${today}`,
    message: `ניתחת ${todayAnalysisCount} מתוך ${limit} הידיים היומיות בתוכנית החינמית`,
    href: "/billing",
    createdAt: Date.now(),
  };
}

/** "השתפרת ב-X השבוע" — reuses buildWeeklyReview()'s already-cheap `improved` list (topLeaks
 *  over the last 7 days + a trend check per leak, the same computation /weekly-review does)
 *  rather than inventing a new weekly-improvement signal from scratch. Skips the iqWeeklyDelta
 *  argument (defaults to null) since only `improved` is needed here. */
function improvementNotification(hands: StoredHand[]): AppNotification | null {
  if (hands.length === 0) return null;
  const { improved } = buildWeeklyReview(hands);
  const top = improved[0];
  if (!top) return null;
  const label = formatLeakKey(top.leak.dimension, top.leak.key);
  const thisWeekKey = isoWeekKey(Date.now());
  return {
    id: `improvement-${thisWeekKey}-${top.leak.dimension}-${top.leak.key}`,
    message: `השתפרת ב-${label} השבוע`,
    href: "/weekly-review",
    createdAt: Date.now(),
  };
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

/** The 4 notification "kinds" a user can individually mute from Settings → התראות. Notifications
 *  that aren't tied to a category (streak milestones, achievements, high-severity leaks, weekly
 *  improvement) are treated as always-on core signals — there was no toggle requested for them,
 *  and they're exactly what survives the "low" frequency filter below too. */
export type NotificationCategory = "weeklyReport" | "missions" | "returnToApp" | "productUpdates";

export type NotificationFrequency = "low" | "normal" | "high";

export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, string> = {
  weeklyReport: "דוח שבועי",
  missions: "משימות",
  returnToApp: "חזרה לאפליקציה",
  productUpdates: "עדכוני מוצר/מנוי",
};

export interface NotificationContext {
  /** Current plan — defaults to "FREE" (harmless default: with todayAnalysisCount also
   *  defaulting to 0, the usage nudge simply never fires for callers that don't pass this). */
  plan?: Plan;
  todayAnalysisCount?: number;
  /** Master on/off switch. Defaults to true. When false, no notifications are returned at all —
   *  which also means the bell's unread badge naturally goes to 0. */
  enabled?: boolean;
  frequency?: NotificationFrequency;
  categories?: Partial<Record<NotificationCategory, boolean>>;
}

interface CategorizedNotification {
  notification: AppNotification | null;
  category?: NotificationCategory;
}

export function computeNotifications(hands: StoredHand[], context: NotificationContext = {}): AppNotification[] {
  if (context.enabled === false) return [];

  const plan: Plan = context.plan ?? "FREE";
  const todayAnalysisCount = context.todayAnalysisCount ?? 0;
  const frequency: NotificationFrequency = context.frequency ?? "normal";
  const categories: Record<NotificationCategory, boolean> = {
    weeklyReport: true,
    missions: true,
    returnToApp: true,
    productUpdates: true,
    ...context.categories,
  };

  // Shared across achievements + the mission reminder so this only runs once per check.
  const trainingProgress = loadProgress();
  const skillTree = computeSkillTree(hands, trainingProgress);
  const achievementsInput: AchievementsInput = {
    hands,
    trainingProgress,
    iqHistory: getIqHistory(),
    roadmap: getRoadmap(),
    skillTree,
  };

  const candidates: CategorizedNotification[] = [
    { notification: highSeverityLeakNotification(hands) },
    { notification: streakMilestoneNotification(hands) },
    { notification: improvementNotification(hands) },
    { notification: weeklyReportNotification(hands), category: "weeklyReport" },
    { notification: noHandsTodayNotification(hands), category: "returnToApp" },
    { notification: missionReminderNotification(hands, skillTree), category: "missions" },
    { notification: usageNudgeNotification(plan, todayAnalysisCount), category: "productUpdates" },
    ...achievementNotifications(achievementsInput).map((notification) => ({ notification })),
  ];

  return candidates
    .filter((c): c is { notification: AppNotification; category?: NotificationCategory } => c.notification !== null)
    // Category toggle: hide anything the user muted in Settings.
    .filter((c) => !c.category || categories[c.category])
    // "low" frequency: only the always-on core signals get through, regardless of category
    // toggles above. "normal" and "high" currently behave the same — there's no extra tier of
    // notification worth adding on top of "normal" yet, so "high" doesn't fake one.
    .filter((c) => frequency !== "low" || c.category === undefined)
    .map((c) => c.notification);
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

// ---------------------------------------------------------------------------
// Dismissed state (localStorage) — same rationale as read/unread above: notifications are
// recomputed fresh, so "deleting" one from the /notifications page can't remove a record that
// doesn't exist. Instead it's remembered as permanently dismissed, the same way "read" is
// remembered, so it stays hidden even if its underlying condition is still true on a later check.
// ---------------------------------------------------------------------------

const DISMISSED_IDS_KEY = "pra:notifications:dismissed:v1";
const MAX_DISMISSED_IDS = 200;

export function getDismissedIds(): string[] {
  return readJson<string[]>(DISMISSED_IDS_KEY, []);
}

export function dismissNotification(id: string): void {
  const merged = [...getDismissedIds().filter((existing) => existing !== id), id];
  writeJson(DISMISSED_IDS_KEY, merged.slice(-MAX_DISMISSED_IDS));
}

/** Filters dismissed notifications out — call after computeNotifications() in every UI surface
 *  (bell dropdown, /notifications page) so a deleted notification stays gone everywhere. */
export function visibleNotifications(notifications: AppNotification[]): AppNotification[] {
  const dismissedIds = new Set(getDismissedIds());
  return notifications.filter((n) => !dismissedIds.has(n.id));
}

// ---------------------------------------------------------------------------
// Notification settings (localStorage) — master on/off, frequency preference, and per-category
// mute toggles, set from Settings → התראות. Read here by UI callers (NotificationBell, the
// settings page, /notifications) and passed into computeNotifications() as a NotificationContext;
// computeNotifications itself never touches localStorage directly, so it stays a pure function
// of its explicit arguments.
// ---------------------------------------------------------------------------

export interface NotificationSettings {
  enabled: boolean;
  frequency: NotificationFrequency;
  categories: Record<NotificationCategory, boolean>;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  frequency: "normal",
  categories: {
    weeklyReport: true,
    missions: true,
    returnToApp: true,
    productUpdates: true,
  },
};

const SETTINGS_KEY = "pra:notifications:settings:v1";

export function getNotificationSettings(): NotificationSettings {
  const stored = readJson<Partial<NotificationSettings>>(SETTINGS_KEY, {});
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...stored,
    categories: { ...DEFAULT_NOTIFICATION_SETTINGS.categories, ...stored.categories },
  };
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  writeJson(SETTINGS_KEY, settings);
}
