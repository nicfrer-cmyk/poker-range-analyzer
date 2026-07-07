import type { SkillDomain, SkillTreeResult } from "@/lib/coach/skillTree";
import type { TrackId } from "@/lib/training";
import { dateKey, readJson, writeJson } from "@/lib/coach/coachStorage";

/**
 * 30-Day Roadmap — a personal curriculum generated once from the current skill tree (weakest
 * domains first) and persisted, so "day 14" means the same thing every time the user opens the
 * page. Per-day completion is derived live from activity (see missions.ts), not stored here.
 */

export interface RoadmapDay {
  day: number; // 1-30
  focusDomainId: SkillDomain["id"];
  focusLabel: string;
  suggestedTrackId: TrackId | null;
  targetHands: number;
  goalText: string;
}

export interface RoadmapState {
  startDate: string; // YYYY-MM-DD
  days: RoadmapDay[];
}

const ROADMAP_KEY = "pra:coach:roadmap:v1";
const PLAN_LENGTH = 30;
const TARGET_HANDS_PER_DAY = 5;

function orderedFocusDomains(skillTree: SkillTreeResult): SkillDomain[] {
  const withData = skillTree.domains.filter((d) => d.masteryPct !== null).sort((a, b) => (a.masteryPct as number) - (b.masteryPct as number));
  const withoutData = skillTree.domains.filter((d) => d.masteryPct === null);
  return [...withData, ...withoutData];
}

function goalTextFor(domain: SkillDomain, day: number): string {
  return `יום ${day}: התמקד ב"${domain.label}" — נתח לפחות ${TARGET_HANDS_PER_DAY} ידיים מהסוג הזה, ואם יש תרגול מותאם, השלם סבב בו.`;
}

export function generateRoadmap(skillTree: SkillTreeResult): RoadmapState {
  const focusOrder = orderedFocusDomains(skillTree);
  const rotation = focusOrder.length > 0 ? focusOrder : skillTree.domains;

  const days: RoadmapDay[] = Array.from({ length: PLAN_LENGTH }, (_, i) => {
    const domain = rotation[i % rotation.length] as SkillDomain;
    const day = i + 1;
    return {
      day,
      focusDomainId: domain.id,
      focusLabel: domain.label,
      suggestedTrackId: domain.recommendationTrackId,
      targetHands: TARGET_HANDS_PER_DAY,
      goalText: goalTextFor(domain, day),
    };
  });

  const state: RoadmapState = { startDate: dateKey(), days };
  writeJson(ROADMAP_KEY, state);
  return state;
}

export function getRoadmap(): RoadmapState | null {
  return readJson<RoadmapState | null>(ROADMAP_KEY, null);
}

export function getOrCreateRoadmap(skillTree: SkillTreeResult): RoadmapState {
  return getRoadmap() ?? generateRoadmap(skillTree);
}

/** Which plan day "today" corresponds to (1-based), or null once the 30 days have elapsed. */
export function currentDayIndex(roadmap: RoadmapState): number | null {
  const startMs = new Date(roadmap.startDate).getTime();
  const daysElapsed = Math.floor((Date.now() - startMs) / (24 * 60 * 60 * 1000));
  const dayIndex = daysElapsed + 1;
  return dayIndex >= 1 && dayIndex <= roadmap.days.length ? dayIndex : null;
}

export function roadmapDayFor(roadmap: RoadmapState): RoadmapDay | null {
  const idx = currentDayIndex(roadmap);
  if (idx === null) return null;
  return roadmap.days[idx - 1] ?? null;
}
