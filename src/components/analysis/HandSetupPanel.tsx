"use client";

import { useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { CardPicker } from "@/components/cards/CardPicker";
import { Button } from "@/components/ui/Button";
import { useAnalysisStore, streetFromBoard } from "@/lib/store/analysisStore";

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-base-muted">
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-sm text-base-text outline-none focus:border-accent"
      />
    </label>
  );
}

export function HandSetupPanel() {
  const { input, setHeroCard, setBoardCard, removeBoardCard, setField, usedCards, reset } =
    useAnalysisStore();
  const [pickerTarget, setPickerTarget] = useState<
    { kind: "hero"; index: 0 | 1 } | { kind: "board"; index: number } | null
  >(null);
  const used = usedCards();
  const street = streetFromBoard(input.board.filter(Boolean));

  const pick = (card: string) => {
    if (!pickerTarget) return;
    if (pickerTarget.kind === "hero") setHeroCard(pickerTarget.index, card);
    else setBoardCard(pickerTarget.index, card);
    setPickerTarget(null);
  };

  const boardSlots = [0, 1, 2, 3, 4];

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Hand Setup</PanelTitle>
        <Button size="sm" variant="ghost" onClick={reset}>
          Reset
        </Button>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs text-base-muted">Hero cards</p>
          <div className="flex gap-2">
            {[0, 1].map((i) => (
              <button
                key={i}
                onClick={() =>
                  setPickerTarget({ kind: "hero", index: i as 0 | 1 })
                }
              >
                <PlayingCard card={input.heroCards[i]} size="md" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs text-base-muted">
            Board ({street === "preflop" ? "preflop" : street})
          </p>
          <div className="flex gap-2">
            {boardSlots.map((i) => {
              const isNextEmpty =
                i === input.board.filter(Boolean).length && i < 5;
              const filled = input.board[i];
              if (!filled && !isNextEmpty)
                return <div key={i} className="w-12" />;
              return (
                <button
                  key={i}
                  onClick={() =>
                    filled
                      ? removeBoardCard(i)
                      : setPickerTarget({ kind: "board", index: i })
                  }
                  title={filled ? "Click to remove" : "Click to add"}
                >
                  <PlayingCard card={filled} size="md" faceDown={!filled} />
                </button>
              );
            })}
          </div>
        </div>

        {pickerTarget && (
          <div className="rounded-lg border border-base-border bg-base-panel2 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-base-muted">
                Pick a card for {pickerTarget.kind === "hero" ? `hero card ${pickerTarget.index + 1}` : "the board"}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setPickerTarget(null)}>
                Close
              </Button>
            </div>
            <CardPicker usedCards={used} onPick={pick} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField label="Pot" value={input.pot} onChange={(v) => setField("pot", v)} />
          <NumberField label="To Call" value={input.toCall} onChange={(v) => setField("toCall", v)} />
          <NumberField
            label="Hero Stack"
            value={input.heroStack}
            onChange={(v) => setField("heroStack", v)}
          />
          <NumberField
            label="Players in Hand"
            value={input.numPlayers}
            onChange={(v) => setField("numPlayers", Math.max(2, v))}
          />
        </div>
      </PanelBody>
    </Panel>
  );
}
