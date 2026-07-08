"use client";

import { useState } from "react";
import { RangeBuilder } from "@/components/range/RangeBuilder";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { useAnalysisStore } from "@/lib/store/analysisStore";
import { rangeSelectionPercent } from "@/lib/rangeStats";
import { saveRange } from "@/lib/localRangeStore";

export function Step4VillainRange() {
  const { input, setVillainRangeText } = useAnalysisStore();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const percent = rangeSelectionPercent(input.villainRangeText);

  const handleSaveRange = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveRange(name.trim(), input.villainRangeText);
      setSaved(true);
    } catch {
      setError("שגיאה בשמירת הטווח — נסה שוב.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <RangeBuilder value={input.villainRangeText} onChange={setVillainRangeText} />
      <Panel>
        <PanelBody className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-base-muted">
            הטווח הנוכחי מכיל <b className="text-base-text">{percent.toFixed(1)}%</b> מהידיים
            האפשריות
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              placeholder="שם לטווח המותאם"
              className="rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
            <Button size="sm" variant="secondary" onClick={handleSaveRange} disabled={saving}>
              {saving ? "שומר…" : saved ? "נשמר ✓" : "שמור טווח מותאם"}
            </Button>
          </div>
          {error && <span className="text-xs text-status-risky">{error}</span>}
        </PanelBody>
      </Panel>
    </div>
  );
}
