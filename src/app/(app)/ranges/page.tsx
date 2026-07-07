"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RangeMatrix } from "@/components/range/RangeMatrix";
import { PRESET_RANGES, type PresetRangeKey } from "@/lib/presetRanges";
import { listRanges, saveRange, deleteRange, type StoredRange } from "@/lib/localRangeStore";
import { useAnalysisStore } from "@/lib/store/analysisStore";

function rangeTextToLabels(text: string): Record<string, number> {
  const record: Record<string, number> = {};
  text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .forEach((t) => {
      const clean = t.replace("+", "");
      record[clean] = 1;
    });
  return record;
}

export default function RangeLibraryPage() {
  const router = useRouter();
  const [customRanges, setCustomRanges] = useState<StoredRange[]>([]);
  const [newName, setNewName] = useState("");
  const [newCombos, setNewCombos] = useState("");

  useEffect(() => {
    setCustomRanges(listRanges());
  }, []);

  const loadIntoAnalyzer = (combos: string) => {
    useAnalysisStore.getState().setVillainRangeText(combos);
    router.push("/analyze");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">ספריית טווחים</h1>

      <Panel>
        <PanelHeader>
          <PanelTitle>טווחים מוגדרים מראש</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(PRESET_RANGES) as PresetRangeKey[]).map((key) => (
            <div key={key} className="space-y-2 rounded-lg border border-base-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{PRESET_RANGES[key].label}</span>
                <Button size="sm" variant="secondary" onClick={() => loadIntoAnalyzer(PRESET_RANGES[key].range)}>
                  השתמש
                </Button>
              </div>
              <RangeMatrix selected={rangeTextToLabels(PRESET_RANGES[key].range)} />
            </div>
          ))}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>הטווחים השמורים שלך</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="שם הטווח"
              className="rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
            <input
              value={newCombos}
              onChange={(e) => setNewCombos(e.target.value)}
              placeholder="לדוגמה: 22+,ATs+,KQo"
              className="flex-1 rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
            <Button
              size="sm"
              onClick={() => {
                if (!newName || !newCombos) return;
                saveRange(newName, newCombos);
                setCustomRanges(listRanges());
                setNewName("");
                setNewCombos("");
              }}
            >
              שמירת טווח
            </Button>
          </div>
          {customRanges.length === 0 ? (
            <p className="text-sm text-base-muted">עדיין אין טווחים מותאמים אישית שמורים.</p>
          ) : (
            customRanges.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-base-border p-3">
                <div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-base-muted">{r.combos}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => loadIntoAnalyzer(r.combos)}>
                    השתמש
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      deleteRange(r.id);
                      setCustomRanges(listRanges());
                    }}
                  >
                    מחיקה
                  </Button>
                </div>
              </div>
            ))
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
