"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { computePokerDNA, type DnaMetric } from "@/lib/coach/dna";

function toneForPct(pct: number): "crushing" | "ahead" | "close" | "risky" | "behind" {
  if (pct >= 80) return "crushing";
  if (pct >= 60) return "ahead";
  if (pct >= 40) return "close";
  if (pct >= 20) return "risky";
  return "behind";
}

function MetricCard({ metric }: { metric: DnaMetric }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{metric.label}</PanelTitle>
        {metric.valuePct !== null ? (
          <Badge tone={toneForPct(metric.valuePct)}>{metric.valuePct}%</Badge>
        ) : (
          <Badge tone="neutral">אין מספיק נתונים</Badge>
        )}
      </PanelHeader>
      <PanelBody className="space-y-3">
        {metric.valuePct !== null ? (
          <div className="h-2 w-full overflow-hidden rounded-full bg-base-panel2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${metric.valuePct}%` }}
            />
          </div>
        ) : (
          <p className="text-xs text-base-muted">
            נדרשות עוד ידיים ({metric.sampleSize} מתוך מינימום לתובנה אמינה) כדי לחשב את המדד הזה.
          </p>
        )}
        <p className="text-sm text-base-text">{metric.explanation}</p>
        <p className="text-sm text-accent-soft">{metric.tip}</p>
      </PanelBody>
    </Panel>
  );
}

export default function PokerDnaPage() {
  const [hands, setHands] = useState<StoredHand[]>([]);

  useEffect(() => {
    setHands(listHands());
  }, []);

  const dna = useMemo(() => computePokerDNA(hands), [hands]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ה-DNA שלי</h1>
        <p className="mt-1 text-sm text-base-muted">
          פרופיל משחק דינמי, מבוסס על כל הידיים ששמרת — מתעדכן בכל פעם שאתה מנתח יד נוספת.
        </p>
      </div>

      {hands.length === 0 ? (
        <Panel>
          <PanelBody className="py-12 text-center text-sm text-base-muted">
            עדיין אין ידיים שמורות. נתח כמה ידיים כדי לפתוח את פרופיל ה-DNA שלך.
          </PanelBody>
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>חוזקות בולטות</PanelTitle>
              </PanelHeader>
              <PanelBody className="flex flex-wrap gap-2">
                {dna.strengths.length === 0 ? (
                  <p className="text-sm text-base-muted">עדיין אין מספיק נתונים לזיהוי חוזקות.</p>
                ) : (
                  dna.strengths.map((m) => (
                    <Badge key={m.id} tone="crushing">
                      {m.label}: {m.valuePct}%
                    </Badge>
                  ))
                )}
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader>
                <PanelTitle>נקודות לשיפור</PanelTitle>
              </PanelHeader>
              <PanelBody className="flex flex-wrap gap-2">
                {dna.weaknesses.length === 0 ? (
                  <p className="text-sm text-base-muted">עדיין אין מספיק נתונים לזיהוי חולשות.</p>
                ) : (
                  dna.weaknesses.map((m) => (
                    <Badge key={m.id} tone="behind">
                      {m.label}: {m.valuePct}%
                    </Badge>
                  ))
                )}
              </PanelBody>
            </Panel>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dna.metrics.map((m) => (
              <MetricCard key={m.id} metric={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
