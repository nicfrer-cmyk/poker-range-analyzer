"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PaywallModal } from "@/components/billing/PaywallModal";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { buildWeeklyReview } from "@/lib/coach/weeklyReview";
import { formatLeakKey, LEAK_DIMENSION_LABEL } from "@/lib/labels";
import { loadProgress, type TrainingProgress } from "@/lib/training";
import { computeSkillTree } from "@/lib/coach/skillTree";
import { computePokerIQ, getIqHistory, getWeeklyDelta } from "@/lib/coach/iq";
import { useMockPlan } from "@/lib/useMockPlan";
import { canPerformAction } from "@/lib/plan";

const PAYWALL_TITLE = "פתח את המאמן האישי המלא שלך";
const PAYWALL_BODY =
  "כבר התחלת לנתח ידיים. שדרוג ל-Pro יפתח לך ניתוחים ללא הגבלה, דוחות מלאים, זיהוי דפוסים ותוכנית לימוד אישית.";

export default function WeeklyReviewPage() {
  const [hands, setHands] = useState<StoredHand[]>([]);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [plan] = useMockPlan();
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    setHands(listHands());
    setProgress(loadProgress());
  }, []);

  const fullReportAllowed = canPerformAction(plan, "viewFullWeeklyReport").allowed;

  // Same computeSkillTree/computePokerIQ/getWeeklyDelta chain the dashboard and /iq page use, so
  // the weekly report's IQ movement always matches what those pages show for the same week.
  const iqWeeklyDelta = useMemo(() => {
    if (!progress) return null;
    const skillTree = computeSkillTree(hands, progress);
    const iq = computePokerIQ(hands, progress, skillTree);
    return getWeeklyDelta(getIqHistory(), iq.score);
  }, [hands, progress]);

  const review = useMemo(() => buildWeeklyReview(hands, iqWeeklyDelta), [hands, iqWeeklyDelta]);

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">שינוי ב-Poker IQ</p>
            {review.iqWeeklyDelta === null ? (
              <Badge tone="neutral">עדיין אין היסטוריה של שבוע</Badge>
            ) : (
              <p className={`text-2xl font-bold ${review.iqWeeklyDelta >= 0 ? "text-status-ahead" : "text-status-behind"}`}>
                {review.iqWeeklyDelta >= 0 ? "+" : ""}
                {review.iqWeeklyDelta}
              </p>
            )}
          </PanelBody>
        </Panel>
      </div>

      {fullReportAllowed ? (
        <>
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
        </>
      ) : (
        <Panel className="border-accent/30 bg-accent/5">
          <PanelBody className="space-y-3 py-5 text-center">
            <p className="text-sm text-base-text">
              הדוח המלא כולל את התחומים שהשתפרו, מה דורש עבודה, ויעדים מותאמים אישית לשבוע הבא —
              שדרג לפרו כדי לראות.
            </p>
            <Button onClick={() => setPaywallOpen(true)}>שדרג לפרו</Button>
          </PanelBody>
        </Panel>
      )}

      <PaywallModal
        open={paywallOpen}
        title={PAYWALL_TITLE}
        message={PAYWALL_BODY}
        primaryLabel="שדרג לפרו"
        secondaryLabel="המשך בחינם"
        onSecondaryClick={() => {}}
        hideFooterNote
        onClose={() => setPaywallOpen(false)}
      />
    </div>
  );
}
