"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { loadProgress, type TrainingProgress } from "@/lib/training";
import { computeSkillTree, SKILL_TIER_LABEL, type SkillDomain } from "@/lib/coach/skillTree";

function toneForTier(tier: SkillDomain["tier"]): "crushing" | "ahead" | "close" | "risky" | "neutral" {
  if (tier === "expert") return "crushing";
  if (tier === "good") return "ahead";
  if (tier === "developing") return "close";
  if (tier === "beginner") return "risky";
  return "neutral";
}

function DomainCard({ domain }: { domain: SkillDomain }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{domain.label}</PanelTitle>
        {domain.tier ? (
          <Badge tone={toneForTier(domain.tier)}>{SKILL_TIER_LABEL[domain.tier]}</Badge>
        ) : (
          <Badge tone="neutral">אין מספיק נתונים</Badge>
        )}
      </PanelHeader>
      <PanelBody className="space-y-3">
        <p className="text-sm text-base-muted">{domain.description}</p>
        {domain.masteryPct !== null ? (
          <div className="h-2 w-full overflow-hidden rounded-full bg-base-panel2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${domain.masteryPct}%` }} />
          </div>
        ) : (
          <p className="text-xs text-base-muted">{domain.note ?? `יש עד כה ${domain.sampleSize} דוגמאות רלוונטיות.`}</p>
        )}
        {domain.recommendationTrackId && (
          <Link href={`/training?track=${domain.recommendationTrackId}`}>
            <Button size="sm" variant="secondary">
              תרגול מומלץ בתחום הזה
            </Button>
          </Link>
        )}
      </PanelBody>
    </Panel>
  );
}

export default function SkillTreePage() {
  const [hands, setHands] = useState<StoredHand[]>([]);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);

  useEffect(() => {
    listHands().then(setHands);
    setProgress(loadProgress());
  }, []);

  const skillTree = useMemo(() => (progress ? computeSkillTree(hands, progress) : null), [hands, progress]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">עץ מיומנויות</h1>
        <p className="mt-1 text-sm text-base-muted">
          שליטה בכל תחום, מבוססת על הידיים ששמרת ועל האימונים שהשלמת.
        </p>
      </div>

      {skillTree && skillTree.weakestDomain && (
        <Panel className="border-accent/40">
          <PanelBody className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="text-sm">
              התחום שכדאי להתמקד בו כרגע: <b>{skillTree.weakestDomain.label}</b>
            </span>
            {skillTree.weakestDomain.recommendationTrackId && (
              <Link href={`/training?track=${skillTree.weakestDomain.recommendationTrackId}`}>
                <Button size="sm">התחל אימון מותאם</Button>
              </Link>
            )}
          </PanelBody>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skillTree?.domains.map((d) => <DomainCard key={d.id} domain={d} />)}
      </div>
    </div>
  );
}
