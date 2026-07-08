"use client";

import { useMemo, useState } from "react";
import { RangeMatrix, cellLabel } from "./RangeMatrix";
import { PRESET_RANGES, type PresetRangeKey } from "@/lib/presetRanges";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

/** Very small local range-text -> matrix-weights expander, mirrors the engine's parser
 *  at a UI level so the matrix can render immediately; the authoritative combo expansion
 *  for equity math happens in the engine (src/lib/engine/range.ts). */
function expandRangeTextToLabels(text: string): Set<string> {
  const labels = new Set<string>();
  const tokens = text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const allLabelsFor = (r1: string, r2: string, suited: "s" | "o" | "pair") => {
    if (suited === "pair") return `${r1}${r1}`;
    return `${r1}${r2}${suited}`;
  };

  for (const token of tokens) {
    const plus = token.endsWith("+");
    const base = plus ? token.slice(0, -1) : token;

    if (/^[2-9TJQKA]{2}$/.test(base) && base[0] === base[1]) {
      // pair, e.g. "77" or "22+"
      const rank = base[0]!;
      const idx = RANKS.indexOf(rank);
      const range = plus ? RANKS.slice(0, idx + 1) : [rank];
      range.forEach((r) => labels.add(`${r}${r}`));
      continue;
    }

    const m = /^([2-9TJQKA])([2-9TJQKA])(s|o)$/.exec(base);
    if (m) {
      const r1 = m[1]!;
      const r2 = m[2]!;
      const kind = m[3] as "s" | "o";
      if (!plus) {
        labels.add(allLabelsFor(r1, r2, kind));
        continue;
      }
      // "+" on a suited/offsuit combo: step the second rank up toward the first
      const idx1 = RANKS.indexOf(r1);
      const idx2 = RANKS.indexOf(r2);
      for (let i = idx2; i > idx1; i--) {
        labels.add(allLabelsFor(r1, RANKS[i]!, kind));
      }
      continue;
    }
  }
  return labels;
}

/** Standard poker combinatorics for a 2-rank matrix label, matching how src/lib/engine/range.ts
 *  expands ranges: a pocket pair has C(4,2)=6 suit combos, a suited hand has 4 (one per suit),
 *  and an offsuit hand has 12 (4 suits x 3 non-matching suits). */
function comboCountForLabel(label: string): number {
  if (label.length === 2) return 6;
  return label.endsWith("s") ? 4 : 12;
}

function tooltipForLabel(label: string): string {
  return `${label} — ${comboCountForLabel(label)} קומבואים`;
}

export function RangeBuilder({
  value,
  onChange,
  title = "הטווח של היריב",
}: {
  value: string;
  onChange: (text: string) => void;
  /** Panel title — defaults to the original "villain range" wording so existing callers are
   *  unaffected. Pass a different title to reuse this same builder for a second range input
   *  (e.g. the hero's own range on the Range vs Range page). */
  title?: string;
}) {
  const [manualLabels, setManualLabels] = useState<Set<string> | null>(null);

  const labels = manualLabels ?? expandRangeTextToLabels(value);
  const selected = useMemo(() => {
    const rec: Record<string, number> = {};
    labels.forEach((l) => (rec[l] = 1));
    return rec;
  }, [labels]);

  const toggle = (label: string) => {
    const next = new Set(labels);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    setManualLabels(next);
    onChange(labelsToRangeText(next));
  };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PRESET_RANGES) as PresetRangeKey[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant="secondary"
              onClick={() => {
                setManualLabels(null);
                onChange(PRESET_RANGES[key].range);
              }}
            >
              {PRESET_RANGES[key].label}
            </Button>
          ))}
        </div>
        <input
          value={value}
          onChange={(e) => {
            setManualLabels(null);
            onChange(e.target.value);
          }}
          placeholder="לדוגמה: 22+,ATs+,KQo"
          className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <RangeMatrix selected={selected} onToggle={toggle} onTooltip={tooltipForLabel} />
      </PanelBody>
    </Panel>
  );
}

function labelsToRangeText(labels: Set<string>): string {
  return Array.from(labels).sort().join(",");
}

export { cellLabel };
