"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import {
  todayStats,
  weekStats,
  monthStats,
  allTimeStats,
  currentStreak,
  buildChallenges,
} from "@/lib/leaderboard";

function StatCard({ title, stats }: { title: string; stats: { handCount: number; accuracyPct: number; points: number } }) {
  return (
    <Panel>
      <PanelBody className="space-y-1">
        <p className="text-xs text-base-muted">{title}</p>
        <p className="text-2xl font-bold">{stats.handCount}</p>
        <p className="text-xs text-base-muted">ידיים · דיוק {stats.accuracyPct.toFixed(0)}% · {stats.points} נקודות</p>
      </PanelBody>
    </Panel>
  );
}

function ChallengeBar({
  title,
  description,
  progress,
  target,
  unit,
}: {
  title: string;
  description: string;
  progress: number;
  target: number;
  unit: string;
}) {
  const pct = Math.min(100, (progress / target) * 100);
  const done = progress >= target;
  return (
    <div className="rounded-lg border border-base-border p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        {done && <Badge tone="ahead">הושלם 🎉</Badge>}
      </div>
      <p className="mb-2 text-xs text-base-muted">{description}</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-base-panel2">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-base-muted">
        {progress} / {target} {unit}
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  const [hands, setHands] = useState<StoredHand[]>([]);

  useEffect(() => {
    listHands().then(setHands);
  }, []);

  const today = useMemo(() => todayStats(hands), [hands]);
  const week = useMemo(() => weekStats(hands), [hands]);
  const month = useMemo(() => monthStats(hands), [hands]);
  const allTime = useMemo(() => allTimeStats(hands), [hands]);
  const streak = useMemo(() => currentStreak(hands), [hands]);
  const challenges = useMemo(() => buildChallenges(hands), [hands]);

  if (hands.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">אתגרים והישגים</h1>
        <Panel>
          <PanelBody className="py-12 text-center text-sm text-base-muted">
            עדיין אין ידיים שמורות. נתח ושמור כמה ידיים כדי להתחיל לצבור נקודות ולעקוב אחרי
            הרצף שלך.
          </PanelBody>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">אתגרים והישגים</h1>
        <Badge tone="ahead">🔥 רצף של {streak} ימים</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="היום" stats={today} />
        <StatCard title="השבוע" stats={week} />
        <StatCard title="החודש" stats={month} />
        <StatCard title="סך הכול" stats={allTime} />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>האתגרים שלי</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3">
          {challenges.map((c) => (
            <ChallengeBar
              key={c.id}
              title={c.title}
              description={c.description}
              progress={c.progress}
              target={c.target}
              unit={c.unit}
            />
          ))}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelBody className="text-xs leading-relaxed text-base-muted">
          כרגע כל הנתונים נשמרים רק בדפדפן שלך, כך שהאתגרים הם אישיים ולא מול שחקנים אחרים.
          לוח מובילים אמיתי מול חברים יגיע לאחר שהשמירה תעבור לענן.
        </PanelBody>
      </Panel>
    </div>
  );
}
