"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { useAnalysisStore, streetFromBoard, ACTION_LABEL } from "@/lib/store/analysisStore";
import type { ActionTaken } from "@/lib/engine/leakFinder";

const STREET_LABEL: Record<string, string> = {
  preflop: "פרה-פלופ",
  flop: "פלופ",
  turn: "טרן",
  river: "ריבר",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-base-muted">
      {label}
      {children}
    </label>
  );
}

const inputClass =
  "rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-sm text-base-text outline-none focus:border-accent";

export function Step3PotDecision() {
  const { input, setField } = useAnalysisStore();
  const street = streetFromBoard(input.board.filter(Boolean));

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>שלב 3 · קופה והחלטה</PanelTitle>
        <Badge tone="neutral">הרחוב: {STREET_LABEL[street]}</Badge>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="קופה">
            <input
              type="number"
              min={0}
              value={input.pot}
              onChange={(e) => setField("pot", Number(e.target.value) || 0)}
              className={inputClass}
            />
          </Field>
          <Field label="סכום להשלמה">
            <input
              type="number"
              min={0}
              value={input.toCall}
              onChange={(e) => setField("toCall", Number(e.target.value) || 0)}
              className={inputClass}
            />
          </Field>
          <Field label="הסטאק שלי">
            <input
              type="number"
              min={0}
              value={input.heroStack}
              onChange={(e) => setField("heroStack", Number(e.target.value) || 0)}
              className={inputClass}
            />
          </Field>
          <Field label="שחקנים ביד">
            <input
              type="number"
              min={2}
              value={input.numPlayers}
              onChange={(e) => setField("numPlayers", Math.max(2, Number(e.target.value) || 2))}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="הפעולה שביצעתי">
            <select
              value={input.actionTaken}
              onChange={(e) => setField("actionTaken", e.target.value as ActionTaken)}
              className={inputClass}
            >
              {(Object.keys(ACTION_LABEL) as ActionTaken[]).map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABEL[a]}
                </option>
              ))}
            </select>
          </Field>
          {(input.actionTaken === "bet" || input.actionTaken === "raise") && (
            <Field label="גודל ההימור">
              <input
                type="number"
                min={0}
                value={input.betSize}
                onChange={(e) => setField("betSize", Number(e.target.value) || 0)}
                className={inputClass}
              />
            </Field>
          )}
        </div>
      </PanelBody>
    </Panel>
  );
}
