"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import {
  useAnalysisStore,
  POSITIONS_BY_TABLE_SIZE,
  type GameType,
} from "@/lib/store/analysisStore";

const GAME_TYPES: { value: GameType; label: string }[] = [
  { value: "cash", label: "קאש" },
  { value: "tournament", label: "טורניר" },
  { value: "sng", label: "סיט אנד גו" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-base-muted">
      {label}
      {children}
    </label>
  );
}

const selectClass =
  "rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-sm text-base-text outline-none focus:border-accent";
const inputClass =
  "rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-sm text-base-text outline-none focus:border-accent";

export function Step1GameType() {
  const { input, setField } = useAnalysisStore();
  const positions = POSITIONS_BY_TABLE_SIZE[input.tableSize] ?? POSITIONS_BY_TABLE_SIZE[6]!;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>שלב 1 · סוג משחק</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {GAME_TYPES.map((g) => (
            <Button
              key={g.value}
              size="sm"
              variant={input.gameType === g.value ? "primary" : "secondary"}
              onClick={() => setField("gameType", g.value)}
            >
              {g.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="מספר שחקנים בשולחן">
            <select
              value={input.tableSize}
              onChange={(e) => {
                const size = Number(e.target.value);
                setField("tableSize", size);
                const opts = POSITIONS_BY_TABLE_SIZE[size] ?? POSITIONS_BY_TABLE_SIZE[6]!;
                if (!opts.includes(input.heroPosition)) setField("heroPosition", opts[0]!);
                if (!opts.includes(input.villainPosition))
                  setField("villainPosition", opts[opts.length - 1]!);
              }}
              className={selectClass}
            >
              {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>

          <Field label="בליינד קטן">
            <input
              type="number"
              min={0}
              value={input.smallBlind}
              onChange={(e) => setField("smallBlind", Number(e.target.value) || 0)}
              className={inputClass}
            />
          </Field>
          <Field label="בליינד גדול">
            <input
              type="number"
              min={0}
              value={input.bigBlind}
              onChange={(e) => setField("bigBlind", Number(e.target.value) || 0)}
              className={inputClass}
            />
          </Field>
          <Field label="סטאק אפקטיבי">
            <input
              type="number"
              min={0}
              value={input.heroStack}
              onChange={(e) => setField("heroStack", Number(e.target.value) || 0)}
              className={inputClass}
            />
          </Field>

          <Field label="פוזיציית הירו">
            <select
              value={input.heroPosition}
              onChange={(e) => setField("heroPosition", e.target.value)}
              className={selectClass}
            >
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="פוזיציית היריב">
            <select
              value={input.villainPosition}
              onChange={(e) => setField("villainPosition", e.target.value)}
              className={selectClass}
            >
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </PanelBody>
    </Panel>
  );
}
