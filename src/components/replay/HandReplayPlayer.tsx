"use client";

import { useMemo, useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge, equityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { STREET_LABEL } from "@/lib/labels";
import { ACTION_LABEL } from "@/lib/store/analysisStore";
import { buildReplaySteps, type ReplayStep } from "@/lib/coach/handReplay";
import type { StoredHand } from "@/lib/localHandStore";

/** Interactive preflop -> decision-street replay. At every street the user is asked to stop and
 *  think before the equity/decision analysis is revealed — no live-play assistance, purely a
 *  post-game learning walkthrough (see PostGameNotice in AppShell). */
export function HandReplayPlayer({ hand }: { hand: StoredHand }) {
  const steps = useMemo(() => buildReplaySteps(hand), [hand]);
  const [stepIndex, setStepIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  if (steps.length === 0) {
    return (
      <Panel>
        <PanelBody className="py-8 text-center text-sm text-base-muted">
          אין מספיק מידע ביד הזו כדי לבנות replay (חסרים קלפי הירו).
        </PanelBody>
      </Panel>
    );
  }

  const step = steps[stepIndex] as ReplayStep;
  const isLastStep = stepIndex === steps.length - 1;

  const goNext = () => {
    if (isLastStep) return;
    setStepIndex((i) => i + 1);
    setRevealed(false);
  };
  const goBack = () => {
    if (stepIndex === 0) return;
    setStepIndex((i) => i - 1);
    setRevealed(false);
  };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>צפייה חוזרת ביד</PanelTitle>
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <Badge key={s.street} tone={i === stepIndex ? "ahead" : "neutral"}>
              {STREET_LABEL[s.street] ?? s.street}
            </Badge>
          ))}
        </div>
      </PanelHeader>
      <PanelBody className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-base-muted">היד שלך</p>
            <div className="flex gap-1.5">
              {hand.heroCards.map((c, i) => (
                <PlayingCard key={i} card={c} size="lg" />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-base-muted">
              {step.board.length === 0 ? "בורד (עוד לא יצא)" : "בורד"}
            </p>
            <div className="flex gap-1.5">
              {step.board.length === 0 ? (
                <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-base-border text-[11px] text-base-muted">
                  אין עדיין
                </div>
              ) : (
                step.board.map((c, i) => <PlayingCard key={`${c}-${i}`} card={c} size="lg" />)
              )}
            </div>
          </div>
          <div className="space-y-1 text-end">
            <p className="text-xs text-base-muted">פוט (בזמן הניתוח)</p>
            <p className="text-lg font-semibold">{hand.potSize}</p>
          </div>
        </div>

        {step.actions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-base-muted">פעולות שנרשמו ברחוב הזה</p>
            <div className="flex flex-wrap gap-2">
              {step.actions.map((a, i) => (
                <span key={i} className="rounded-full border border-base-border px-2.5 py-1 text-xs text-base-muted">
                  {a.player}: {a.actionLabel}
                  {a.amount ? ` (${a.amount})` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
        {step.actions.length === 0 && !step.hasRecordedActions && (
          <p className="text-xs text-base-muted">פעולות מפורטות לא נשמרו עבור יד זו — הצעד הזה הוא לימוד אקוויטי בלבד.</p>
        )}

        {!revealed ? (
          <div className="rounded-lg border border-dashed border-base-border p-4 text-center">
            <p className="mb-3 text-sm text-base-text">
              {step.isDecisionPoint
                ? "זו נקודת ההחלטה שנשמרה. עצור וחשוב: מה היית עושה כאן?"
                : "עצור וחשוב: איך היד שלך עומדת ברחוב הזה, לפני שממשיכים?"}
            </p>
            <Button onClick={() => setRevealed(true)}>הצג ניתוח</Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-base-border bg-base-panel2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {step.heroEquityPct !== null ? (
                <Badge tone={equityTone(step.heroEquityPct)}>אקוויטי {step.heroEquityPct.toFixed(0)}%</Badge>
              ) : (
                <Badge tone="neutral">אין מספיק צירופים בטווח היריב כדי לחשב אקוויטי</Badge>
              )}
              {step.isDecisionPoint && (
                <Badge tone="neutral">נבחרה בפועל: {ACTION_LABEL[hand.actionTaken]}</Badge>
              )}
            </div>
            {step.isDecisionPoint && step.decision && (
              <p className="text-sm leading-relaxed text-base-text">
                {step.decision.isGood
                  ? "זו הייתה החלטה קרובה להחלטה הטובה ביותר לפי המנוע."
                  : `כאן היה אפשר להרוויח יותר — אובדן EV משוער של ${step.decision.evLossEstimate.toFixed(2)}.`}
              </p>
            )}
            {!step.isDecisionPoint && (
              <p className="text-sm leading-relaxed text-base-text">
                זהו שלב לימודי בלבד (לא נקודת ההחלטה שנשמרה) — המטרה היא להתרגל לעקוב אחרי האקוויטי שלך בכל רחוב.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="secondary" onClick={goBack} disabled={stepIndex === 0}>
            → רחוב קודם
          </Button>
          {!isLastStep ? (
            <Button onClick={goNext} disabled={!revealed}>
              רחוב הבא ←
            </Button>
          ) : (
            <Badge tone="neutral">סוף הצפייה החוזרת</Badge>
          )}
        </div>
      </PanelBody>
    </Panel>
  );
}
