"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { loadProgress, type TrainingProgress } from "@/lib/training";
import { computeSkillTree } from "@/lib/coach/skillTree";
import { getOrCreateRoadmap, generateRoadmap, currentDayIndex, type RoadmapState } from "@/lib/coach/roadmap";

export default function RoadmapPage() {
  const [hands, setHands] = useState<StoredHand[]>([]);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapState | null>(null);

  useEffect(() => {
    setHands(listHands());
    setProgress(loadProgress());
  }, []);

  const skillTree = useMemo(() => (progress ? computeSkillTree(hands, progress) : null), [hands, progress]);

  useEffect(() => {
    if (!skillTree) return;
    setRoadmap(getOrCreateRoadmap(skillTree));
  }, [skillTree]);

  const todayIndex = roadmap ? currentDayIndex(roadmap) : null;

  const handleRegenerate = () => {
    if (!skillTree) return;
    setRoadmap(generateRoadmap(skillTree));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">תוכנית אישית ל-30 יום</h1>
          <p className="mt-1 text-sm text-base-muted">
            תוכנית לימוד יומית, בנויה מהתחומים החלשים ביותר שלך כרגע ומתעדכנת כשהם משתנים.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRegenerate}>
          בנה תוכנית מחדש
        </Button>
      </div>

      {roadmap && (
        <Panel className="border-accent/40">
          <PanelBody className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="text-sm">
              {todayIndex ? `אתה ביום ${todayIndex} מתוך 30.` : "התוכנית הסתיימה — בנה תוכנית חדשה כדי להמשיך."}
            </span>
          </PanelBody>
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roadmap?.days.map((day) => (
          <Panel key={day.day} className={day.day === todayIndex ? "border-accent" : undefined}>
            <PanelHeader>
              <PanelTitle>יום {day.day}</PanelTitle>
              {day.day === todayIndex && <Badge tone="ahead">היום</Badge>}
              {todayIndex !== null && day.day < todayIndex && <Badge tone="neutral">עבר</Badge>}
            </PanelHeader>
            <PanelBody className="space-y-2">
              <p className="text-xs font-medium text-base-muted">{day.focusLabel}</p>
              <p className="text-sm text-base-text">{day.goalText}</p>
              {day.suggestedTrackId && (
                <Link href={`/training?track=${day.suggestedTrackId}`} className="text-xs text-accent-soft">
                  לתרגול המומלץ ←
                </Link>
              )}
            </PanelBody>
          </Panel>
        ))}
      </div>
    </div>
  );
}
