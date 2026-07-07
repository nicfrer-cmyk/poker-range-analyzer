"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { buildWeeklyReview } from "@/lib/coach/weeklyReview";
import { formatLeakKey, LEAK_DIMENSION_LABEL } from "@/lib/labels";

export default function WeeklyReviewPage() {
  const [hands, setHands] = useState<StoredHand[]>([]);

  useEffect(() => {
    setHands(listHands());
  }, []);

  const review = useMemo(() => buildWeeklyReview(hands), [hands]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">סיכום שבועי</h1>
        <p className="mt-1 text-sm text-base-muted">דוח שבועי אוטומטי, מבוסס על הידיים ששמרת בשבוע האחרון.</p>
      </div>

      <Panel>
        <PanelBody className="space-y-2 py-5">
          <p className="text-sm leading-relaxed text-base-text">{review.summaryHe}</p>
        </PanelBody>
      </Panel>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">ידיים השבוע</p>
            <p className="text-2xl font-bold">{review.weekHandCount}</p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">דיוק החלטות השבוע</p>
            <p className="text-2xl font-bold text-status-ahead">{Math.round(review.weekAccuracyPct)}%</p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">טעויות חוזרות שזוהו</p>
            <p className="text-2xl font-bold text-status-behind">{review.repeatedMistakes.length}</p>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>תחומים שהשתפרו</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-2">
            {review.improved.length === 0 ? (
              <p className="text-sm text-base-muted">עדיין לא נראה שיפור מובחן השבוע.</p>
            ) : (
              review.improved.map((t) => (
                <div key={`${t.leak.dimension}-${t.leak.key}`} className="flex items-center justify-between rounded-lg border border-base-border px-3 py-2">
                  <span className="text-sm">
                    {LEAK_DIMENSION_LABEL[t.leak.dimension] ?? t.leak.dimension}: <b>{formatLeakKey(t.leak.dimension, t.leak.key)}</b>
                  </span>
                  <Badge tone="crushing">משתפר</Badge>
                </div>
              ))
            )}
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader>
            <PanelTitle>תחומים שדורשים עבודה</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-2">
            {review.needsWork.length === 0 ? (
              <p className="text-sm text-base-muted">לא זוהו תחומים בעייתיים בולטים השבוע.</p>
            ) : (
              review.needsWork.map((t) => (
                <div key={`${t.leak.dimension}-${t.leak.key}`} className="flex items-center justify-between rounded-lg border border-base-border px-3 py-2">
                  <span className="text-sm">
                    {LEAK_DIMENSION_LABEL[t.leak.dimension] ?? t.leak.dimension}: <b>{formatLeakKey(t.leak.dimension, t.leak.key)}</b>
                  </span>
                  <Badge tone="behind">דורש עבודה</Badge>
                </div>
              ))
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>יעדים לשבוע הבא</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2">
          {review.goalsNextWeek.map((g, i) => (
            <div key={i} className="flex gap-3 rounded-lg border border-base-border p-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-base-panel2 text-xs font-semibold text-base-muted">
                {i + 1}
              </span>
              <p className="text-sm text-base-text">{g}</p>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Link href="/leaks" className="text-xs text-accent-soft">
              לצפייה בכל הדליפות ←
            </Link>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
