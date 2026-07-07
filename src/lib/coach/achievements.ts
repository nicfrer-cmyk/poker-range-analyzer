import type { StoredHand } from "@/lib/localHandStore";
import { currentStreak } from "@/lib/leaderboard";
import { BADGES, type TrainingProgress } from "@/lib/training";
import type { IqSnapshot } from "@/lib/coach/iq";
import type { RoadmapState } from "@/lib/coach/roadmap";
import { currentDayIndex } from "@/lib/coach/roadmap";
import type { SkillTreeResult } from "@/lib/coach/skillTree";

/**
 * Achievements — combines the existing training-quiz badges (src/lib/training.ts's BADGES,
 * already earned/tracked there) with new coach-level milestones, into one gallery. Motivation
 * only, per the product spec: never implies a financial/results guarantee.
 */

export const ACHIEVEMENTS_DISCLAIMER_HE =
  "ההישגים הם למוטיבציה בלבד ואינם מבטיחים תוצאות כספיות או הצלחה במשחק.";

export interface Achievement {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  category: "training" | "coach";
}

function maxScoreJumpWithinDays(history: IqSnapshot[], days: number): number {
  let best = 0;
  for (let i = 0; i < history.length; i++) {
    const windowStart = new Date(history[i]!.date).getTime() - days * 24 * 60 * 60 * 1000;
    for (let j = 0; j < i; j++) {
      if (new Date(history[j]!.date).getTime() >= windowStart) {
        best = Math.max(best, history[i]!.score - history[j]!.score);
      }
    }
  }
  return best;
}

export interface AchievementsInput {
  hands: StoredHand[];
  trainingProgress: TrainingProgress;
  iqHistory: IqSnapshot[];
  roadmap: RoadmapState | null;
  skillTree: SkillTreeResult;
}

export function computeAchievements(input: AchievementsInput): Achievement[] {
  const { hands, trainingProgress, iqHistory, roadmap, skillTree } = input;

  const trainingAchievements: Achievement[] = BADGES.map((b) => ({
    id: b.id,
    label: b.label,
    description: b.description,
    earned: trainingProgress.earnedBadgeIds.includes(b.id),
    category: "training" as const,
  }));

  const streak = currentStreak(hands);
  const roadmapDay = roadmap ? currentDayIndex(roadmap) ?? 0 : 0;
  const domainsWithData = skillTree.domains.filter((d) => d.masteryPct !== null);
  const allDomainsGood = domainsWithData.length >= 6 && domainsWithData.every((d) => (d.masteryPct as number) >= 50);

  const coachAchievements: Achievement[] = [
    { id: "hands-100", label: "100 ידיים נותחו", description: "ניתחת או ייבאת 100 ידיים לספרייה.", earned: hands.length >= 100, category: "coach" },
    { id: "hands-300", label: "300 ידיים נותחו", description: "ניתחת או ייבאת 300 ידיים לספרייה.", earned: hands.length >= 300, category: "coach" },
    { id: "streak-7-days", label: "שבוע רצוף", description: "7 ימים רצופים עם לפחות יד אחת שנשמרה.", earned: streak >= 7, category: "coach" },
    { id: "streak-30-days", label: "חודש רצוף", description: "30 ימים רצופים עם לפחות יד אחת שנשמרה — התמדה אמיתית.", earned: streak >= 30, category: "coach" },
    { id: "iq-up-50", label: "שיפור ב-Poker IQ", description: "עלייה של 50+ נקודות ב-Poker IQ בתוך שבוע.", earned: maxScoreJumpWithinDays(iqHistory, 7) >= 50, category: "coach" },
    { id: "roadmap-day-7", label: "שבוע בתוכנית ה-30 יום", description: "הגעת ליום ה-7 בתוכנית האישית.", earned: roadmapDay >= 7, category: "coach" },
    { id: "roadmap-day-14", label: "חצי הדרך בתוכנית", description: "הגעת ליום ה-14 בתוכנית האישית.", earned: roadmapDay >= 14, category: "coach" },
    { id: "roadmap-day-30", label: "השלמת תוכנית 30 יום", description: "הגעת ליום ה-30 בתוכנית האישית.", earned: roadmapDay >= 30, category: "coach" },
    { id: "all-skills-good", label: "שליטה רב-תחומית", description: "כל תחומי המיומנות עם מספיק נתונים עומדים על 50%+ מאסטרי.", earned: allDomainsGood, category: "coach" },
  ];

  return [...trainingAchievements, ...coachAchievements];
}
