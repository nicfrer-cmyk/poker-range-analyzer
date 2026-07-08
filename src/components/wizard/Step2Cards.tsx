"use client";

import { useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { CardPicker } from "@/components/cards/CardPicker";
import { Button } from "@/components/ui/Button";
import { useAnalysisStore, streetFromBoard } from "@/lib/store/analysisStore";

const STREET_LABEL: Record<string, string> = {
  preflop: "פרה-פלופ",
  flop: "פלופ",
  turn: "טרן",
  river: "ריבר",
};

type PickerTarget = { kind: "hero"; index: 0 | 1 } | { kind: "board"; indices: number[] };

export function Step2Cards() {
  const { input, setHeroCard, setBoardCard, removeBoardCard, usedCards } = useAnalysisStore();
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const used = usedCards();
  const filledBoard = input.board.filter(Boolean);
  const street = streetFromBoard(filledBoard);

  const pick = (card: string) => {
    if (!pickerTarget) return;
    if (pickerTarget.kind === "hero") {
      setHeroCard(pickerTarget.index, card);
      // Flow straight into the other hero slot if it's still empty, instead of closing —
      // filling one card almost always means the next click would just reopen this same picker.
      const otherIndex = pickerTarget.index === 0 ? 1 : 0;
      setPickerTarget(input.heroCards[otherIndex] ? null : { kind: "hero", index: otherIndex });
      return;
    }
    const nextIndex = pickerTarget.indices.find((i) => !input.board[i]);
    if (nextIndex === undefined) {
      setPickerTarget(null);
      return;
    }
    setBoardCard(nextIndex, card);
    const remaining = pickerTarget.indices.filter((i) => i !== nextIndex && !input.board[i]);
    setPickerTarget(remaining.length > 0 ? { kind: "board", indices: pickerTarget.indices } : null);
  };

  const openBoardPicker = () => {
    const filledCount = filledBoard.length;
    if (filledCount < 3) {
      setPickerTarget({ kind: "board", indices: [0, 1, 2] });
    } else if (filledCount === 3) {
      setPickerTarget({ kind: "board", indices: [3] });
    } else if (filledCount === 4) {
      setPickerTarget({ kind: "board", indices: [4] });
    }
  };

  const boardSlots = [0, 1, 2, 3, 4];
  const remainingToPick =
    pickerTarget?.kind === "board"
      ? pickerTarget.indices.filter((i) => !input.board[i]).length
      : 0;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>שלב 2 · קלפים</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs text-base-muted">הקלפים שלי</p>
          <div className="flex gap-2">
            {[0, 1].map((i) => (
              <button key={i} onClick={() => setPickerTarget({ kind: "hero", index: i as 0 | 1 })}>
                <PlayingCard card={input.heroCards[i]} size="md" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs text-base-muted">הבורד ({STREET_LABEL[street]})</p>
          <div className="flex gap-2">
            {boardSlots.map((i) => {
              const filled = input.board[i];
              const isNextGroupStart =
                (i === 0 && filledBoard.length === 0) ||
                (i === 3 && filledBoard.length === 3) ||
                (i === 4 && filledBoard.length === 4);
              if (!filled && !isNextGroupStart && !(i < 3 && filledBoard.length < 3))
                return <div key={i} className="w-12" />;
              return (
                <button
                  key={i}
                  onClick={() => (filled ? removeBoardCard(i) : openBoardPicker())}
                  title={filled ? "לחץ להסרה" : "לחץ להוספה"}
                >
                  <PlayingCard card={filled} size="md" faceDown={!filled} />
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-base-muted/80">
            לחיצה על הפלופ פותחת בחירה של 3 קלפים ברצף אחד. ניתן להשאיר את הבורד ריק לניתוח
            פרה-פלופ.
          </p>
        </div>

        {pickerTarget && (
          <div className="rounded-lg border border-base-border bg-base-panel2 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-base-muted">
                {pickerTarget.kind === "hero"
                  ? `בחר קלף ליד שלי ${pickerTarget.index + 1}`
                  : remainingToPick > 1
                  ? `בחר ${remainingToPick} קלפים לבורד`
                  : "בחר קלף לבורד"}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setPickerTarget(null)}>
                סגור
              </Button>
            </div>
            <CardPicker usedCards={used} onPick={pick} />
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
