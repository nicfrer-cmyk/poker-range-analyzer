import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { equityTone } from "@/lib/statusTone";
import { MADE_TIER_LABEL, drawsToHebrew } from "@/lib/labels";
import {
  ACTION_LABEL_HE,
  oddsRatioLabel,
  type AnswerEvaluation,
  type TrainingAction,
  type TrainingScenario,
} from "@/lib/training";

export function TrainingQuestion({
  scenario,
  answer,
  onAnswer,
  onNext,
}: {
  scenario: TrainingScenario;
  answer: AnswerEvaluation | null;
  onAnswer: (action: TrainingAction) => void;
  onNext: () => void;
}) {
  const handLabel = MADE_TIER_LABEL[scenario.classification.madeTier];
  const drawsLabel =
    scenario.classification.draws.length > 0
      ? drawsToHebrew(scenario.classification.draws)
      : null;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>מול {scenario.villainRangeLabel}</PanelTitle>
        <Badge tone="neutral">
          {scenario.board.length === 0
            ? "פרה-פלופ"
            : scenario.board.length === 3
              ? "פלופ"
              : scenario.board.length === 4
                ? "טרן"
                : "ריבר"}
        </Badge>
      </PanelHeader>
      <PanelBody className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-base-muted">היד שלך</p>
            <div className="flex gap-1.5">
              {scenario.heroCards.map((c) => (
                <PlayingCard key={c} card={c} size="lg" />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-base-muted">
              {scenario.board.length === 0 ? "בורד (עוד לא יצא)" : "בורד"}
            </p>
            <div className="flex gap-1.5">
              {scenario.board.length === 0 ? (
                <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-base-border text-[11px] text-base-muted">
                  אין עדיין
                </div>
              ) : (
                scenario.board.map((c, i) => <PlayingCard key={`${c}-${i}`} card={c} size="lg" />)
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-base-muted">
          <span className="rounded-full border border-base-border px-2.5 py-1">
            יד: {handLabel}
            {drawsLabel ? ` + ${drawsLabel}` : ""}
          </span>
          {scenario.facingBet ? (
            <span className="rounded-full border border-base-border px-2.5 py-1">
              פוט {scenario.pot} · קריאה {scenario.toCall} · יחס{" "}
              {oddsRatioLabel(scenario.pot, scenario.toCall)}
            </span>
          ) : (
            <span className="rounded-full border border-base-border px-2.5 py-1">
              פוט {scenario.pot} · אין הימור לענות עליו כרגע
            </span>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-base-text">
            מה ההחלטה הכדאית ביותר כאן?
          </p>
          <div className="flex flex-wrap gap-2">
            {scenario.actionOptions.map((action) => {
              const isCorrect = answer && action === answer.correctAction;
              const isUserPick = answer && action === answer.userAction;
              let variant: "primary" | "secondary" | "danger" = "secondary";
              if (answer) {
                if (isCorrect) variant = "primary";
                else if (isUserPick) variant = "danger";
              }
              return (
                <Button
                  key={action}
                  variant={variant}
                  size="md"
                  disabled={!!answer}
                  onClick={() => onAnswer(action)}
                >
                  {ACTION_LABEL_HE[action]}
                  {answer && isCorrect ? " ✓" : ""}
                  {answer && isUserPick && !isCorrect ? " ✕" : ""}
                </Button>
              );
            })}
          </div>
        </div>

        {answer && (
          <div className="space-y-3 rounded-lg border border-base-border bg-base-panel2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={answer.correct ? "ahead" : "behind"}>
                {answer.correct ? "בול! ✓" : "לא בדיוק ✕"}
              </Badge>
              <Badge tone={equityTone(answer.heroEquityPct)}>
                אקוויטי {answer.heroEquityPct.toFixed(0)}%
              </Badge>
              {scenario.facingBet && (
                <Badge tone="neutral">נדרש {answer.requiredEquityPct.toFixed(0)}%</Badge>
              )}
            </div>
            <p className="text-sm leading-relaxed text-base-text">{answer.explanation}</p>
            <div className="flex justify-end">
              <Button onClick={onNext}>השאלה הבאה</Button>
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
