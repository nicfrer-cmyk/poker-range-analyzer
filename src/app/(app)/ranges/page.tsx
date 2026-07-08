"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RangeMatrix } from "@/components/range/RangeMatrix";
import { PRESET_RANGES, type PresetRangeKey } from "@/lib/presetRanges";
import { listRanges, saveRange, deleteRange, updateRange, type StoredRange } from "@/lib/localRangeStore";
import { useAnalysisStore } from "@/lib/store/analysisStore";
import { rangeSelectionPercent } from "@/lib/rangeStats";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCombos, setEditCombos] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listRanges().then(setCustomRanges);
  }, []);

  const refreshRanges = async () => {
    setCustomRanges(await listRanges());
  };

  const loadIntoAnalyzer = (combos: string) => {
    useAnalysisStore.getState().setVillainRangeText(combos);
    router.push("/analyze");
  };

  const startEditing = (r: StoredRange) => {
    setEditingId(r.id);
    setEditName(r.name);
    setEditCombos(r.combos);
  };

  const saveEditing = async () => {
    if (!editingId) return;
    setError(null);
    try {
      await updateRange(editingId, { name: editName.trim() || undefined, combos: editCombos.trim() || undefined });
      await refreshRanges();
      setEditingId(null);
    } catch {
      setError("שגיאה בשמירת הטווח — נסה שוב.");
    }
  };

  const duplicateRange = async (r: StoredRange) => {
    setError(null);
    try {
      await saveRange(`${r.name} (עותק)`, r.combos);
      await refreshRanges();
    } catch {
      setError("שגיאה בשכפול הטווח — נסה שוב.");
    }
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
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{PRESET_RANGES[key].label}</span>
                <Badge tone="neutral">{rangeSelectionPercent(PRESET_RANGES[key].range).toFixed(1)}%</Badge>
              </div>
              <p className="text-xs text-base-muted">{PRESET_RANGES[key].description}</p>
              <RangeMatrix selected={rangeTextToLabels(PRESET_RANGES[key].range)} />
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => loadIntoAnalyzer(PRESET_RANGES[key].range)}
              >
                השתמש
              </Button>
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
              disabled={saving}
              onClick={async () => {
                if (!newName || !newCombos) return;
                setError(null);
                setSaving(true);
                try {
                  await saveRange(newName, newCombos);
                  await refreshRanges();
                  setNewName("");
                  setNewCombos("");
                } catch {
                  setError("שגיאה בשמירת הטווח — נסה שוב.");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "שומר…" : "שמירת טווח"}
            </Button>
          </div>
          {error && <p className="text-sm text-status-risky">{error}</p>}
          {customRanges.length === 0 ? (
            <p className="text-sm text-base-muted">עדיין אין טווחים מותאמים אישית שמורים.</p>
          ) : (
            customRanges.map((r) => {
              const isEditing = editingId === r.id;
              return (
                <div key={r.id} className="space-y-2 rounded-lg border border-base-border p-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
                        />
                        <input
                          value={editCombos}
                          onChange={(e) => setEditCombos(e.target.value)}
                          className="flex-1 rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEditing}>
                          שמירה
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          ביטול
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{r.name}</p>
                          <Badge tone="neutral">{rangeSelectionPercent(r.combos).toFixed(1)}%</Badge>
                        </div>
                        <p className="text-xs text-base-muted">{r.combos}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => loadIntoAnalyzer(r.combos)}>
                          השתמש
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => duplicateRange(r)}>
                          שכפול
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => startEditing(r)}>
                          עריכה
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            setError(null);
                            try {
                              await deleteRange(r.id);
                              await refreshRanges();
                            } catch {
                              setError("שגיאה במחיקת הטווח — נסה שוב.");
                            }
                          }}
                        >
                          מחיקה
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
