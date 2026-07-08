"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { loadProgress, type TrainingProgress } from "@/lib/training";
import { computeSkillTree } from "@/lib/coach/skillTree";
import { generateDailyMissions, getCoachXp, awardXpIfNewlyCompleted, type Mission } from "@/lib/coach/missions";
import { getRoadmap } from "@/lib/coach/roadmap";
import { getIqHistory } from "@/lib/coach/iq";
import { computeAchievements, ACHIEVEMENTS_DISCLAIMER_HE, type Achievement } from "@/lib/coach/achievements";
import { currentStreak } from "@/lib/leaderboard";

function MissionCard({ mission }: { mission: Mission }) {
  const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{mission.title}</PanelTitle>
        {mission.completed ? <Badge tone="crushing">הושלם ✓</Badge> : <Badge tone="neutral">+{mission.xp} XP</Badge>}
      </PanelHeader>
      <PanelBody className="space-y-2">
        <p className="text-sm text-base-muted">{mission.description}</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-base-panel2">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-base-muted">
          {mission.progress} / {mission.target} {mission.unit}
        </p>
      </PanelBody>
    </Panel>
  );
}

export default function MissionsPage() {
  const [hands, setHands] = useState<StoredHand[]>([]);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [xp, setXp] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    listHands().then(setHands);
    setProgress(loadProgress());
  }, []);

  const missions = useMemo(() => {
    if (!progress) return [];
    const skillTree = computeSkillTree(hands, progress);
    return generateDailyMissions(hands, skillTree);
  }, [hands, progress]);

  useEffect(() => {
    if (missions.length === 0 || !progress) return;
    awardXpIfNewlyCompleted(missions);
    setXp(getCoachXp());
    const skillTree = computeSkillTree(hands, progress);
    setAchievements(
      computeAchievements({
        hands,
        trainingProgress: progress,
        iqHistory: getIqHistory(),
        roadmap: getRoadmap(),
        skillTree,
      })
    );
  }, [missions, hands, progress]);

  const earned = achievements.filter((a) => a.earned);
  const streak = currentStreak(hands);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">משימות יומיות</h1>
          <p className="mt-1 text-sm text-base-muted">
            שלוש משימות מתחלפות בכל יום, מבוססות על נקודות החולשה הנוכחיות שלך.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge tone="neutral">נקודות ניסיון: {xp}</Badge>
          {streak > 0 && <Badge tone="ahead">🔥 רצף {streak} ימים</Badge>}
        </div>
      </div>

      {missions.length === 0 ? (
        <Panel>
          <PanelBody className="py-12 text-center text-sm text-base-muted">טוען משימות…</PanelBody>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {missions.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
        </div>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>הישגים ({earned.length}/{achievements.length})</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {achievements.map((a) => (
              <Badge key={a.id} tone={a.earned ? "ahead" : "neutral"} title={a.description}>
                {a.earned ? "🏅" : "🔒"} {a.label}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-base-muted">{ACHIEVEMENTS_DISCLAIMER_HE}</p>
        </PanelBody>
      </Panel>
    </div>
  );
}
