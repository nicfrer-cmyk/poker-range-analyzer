"use client";

import { useEffect, useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import type {
  StoredOpponent,
  TightLoose,
  PassiveAggressive,
} from "@/lib/localOpponentStore";

const inputClass =
  "w-full rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-sm text-base-text outline-none focus:border-accent";

export interface OpponentFormValues {
  name: string;
  tightLoose: TightLoose;
  passiveAggressive: PassiveAggressive;
  notes: string;
}

export function OpponentFormModal({
  open,
  editing,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: StoredOpponent | null;
  onClose: () => void;
  onSubmit: (values: OpponentFormValues) => void;
}) {
  const [name, setName] = useState("");
  const [tightLoose, setTightLoose] = useState<TightLoose>("tight");
  const [passiveAggressive, setPassiveAggressive] = useState<PassiveAggressive>("passive");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setTightLoose(editing?.tightLoose ?? "tight");
    setPassiveAggressive(editing?.passiveAggressive ?? "passive");
    setNotes(editing?.notes ?? "");
  }, [open, editing]);

  if (!open) return null;

  const canSave = name.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <Panel className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <PanelHeader>
          <PanelTitle>{editing ? "עריכת פרופיל יריב" : "פרופיל יריב חדש"}</PanelTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            סגירה
          </Button>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-base-muted">כינוי / שם</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='לדוגמה: "חולצה כחולה שולחן 3"'
              className={inputClass}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-base-muted">טייט / לוס</label>
              <select
                value={tightLoose}
                onChange={(e) => setTightLoose(e.target.value as TightLoose)}
                className={inputClass}
              >
                <option value="tight">טייט</option>
                <option value="loose">לוס</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-base-muted">פסיבי / אגרסיבי</label>
              <select
                value={passiveAggressive}
                onChange={(e) => setPassiveAggressive(e.target.value as PassiveAggressive)}
                className={inputClass}
              >
                <option value="passive">פסיבי</option>
                <option value="aggressive">אגרסיבי</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-base-muted">הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="דפוסים שזיהית, הרגלי הימור, טעויות חוזרות שהוא עושה..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              ביטול
            </Button>
            <Button
              disabled={!canSave}
              onClick={() =>
                onSubmit({
                  name: name.trim(),
                  tightLoose,
                  passiveAggressive,
                  notes: notes.trim(),
                })
              }
            >
              שמירה
            </Button>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
