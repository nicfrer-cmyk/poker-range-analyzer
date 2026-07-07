"use client";

import { useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, equityTone, type StatusTone } from "@/components/ui/Badge";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { STYLE_LABEL, type StoredOpponent } from "@/lib/localOpponentStore";
import type { StoredHand } from "@/lib/localHandStore";

const STREET_LABEL: Record<string, string> = {
  preflop: "פרה-פלופ",
  flop: "פלופ",
  turn: "טרן",
  river: "ריבר",
};

const PLAYER_TYPE: Record<string, { label: string; tone: StatusTone }> = {
  "tight-passive": { label: "סלע (טייט-פסיבי)", tone: "neutral" },
  "tight-aggressive": { label: "TAG (טייט-אגרסיבי)", tone: "ahead" },
  "loose-passive": { label: "תחנת קריאה (לוס-פסיבי)", tone: "risky" },
  "loose-aggressive": { label: "LAG (לוס-אגרסיבי)", tone: "behind" },
};

const NOTES_PREVIEW_LENGTH = 90;

export function OpponentCard({
  opponent,
  hands,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onLinkHand,
  onUnlinkHand,
}: {
  opponent: StoredOpponent;
  hands: StoredHand[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLinkHand: (handId: string) => void;
  onUnlinkHand: (handId: string) => void;
}) {
  const [pickedHandId, setPickedHandId] = useState("");

  const linkedHands = hands.filter((h) => h.opponentId === opponent.id);
  const unlinkedHands = hands.filter((h) => !h.opponentId);
  const playerType = PLAYER_TYPE[`${opponent.tightLoose}-${opponent.passiveAggressive}`];

  const notesPreview =
    opponent.notes.length > NOTES_PREVIEW_LENGTH
      ? `${opponent.notes.slice(0, NOTES_PREVIEW_LENGTH)}…`
      : opponent.notes;

  return (
    <Panel className="flex flex-col">
      <PanelHeader>
        <PanelTitle className="text-base">{opponent.name}</PanelTitle>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            עריכה
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            מחיקה
          </Button>
        </div>
      </PanelHeader>
      <PanelBody className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={opponent.tightLoose === "tight" ? "ahead" : "risky"}>
            {STYLE_LABEL[opponent.tightLoose]}
          </Badge>
          <Badge tone={opponent.passiveAggressive === "aggressive" ? "close" : "neutral"}>
            {STYLE_LABEL[opponent.passiveAggressive]}
          </Badge>
          {playerType && <Badge tone={playerType.tone}>{playerType.label}</Badge>}
        </div>

        <p className="min-h-[2.5rem] text-sm text-base-muted">
          {opponent.notes ? (expanded ? opponent.notes : notesPreview) : "אין הערות עדיין."}
        </p>

        <div className="mt-auto flex items-center justify-between border-t border-base-border pt-3 text-xs text-base-muted">
          <span>
            {linkedHands.length > 0
              ? `${linkedHands.length} ידיים מקושרות`
              : "אין ידיים מקושרות עדיין"}
          </span>
          <Button variant="ghost" size="sm" onClick={onToggleExpand}>
            {expanded ? "הסתר ידיים" : "הצג ידיים"}
          </Button>
        </div>

        {expanded && (
          <div className="space-y-3 border-t border-base-border pt-3">
            {linkedHands.length === 0 ? (
              <p className="text-xs text-base-muted">עדיין לא קישרת ידיים ליריב הזה.</p>
            ) : (
              <div className="space-y-2">
                {linkedHands.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-base-border bg-base-panel2 px-2.5 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="flex gap-1">
                        {h.heroCards.map((c, i) => (
                          <PlayingCard key={i} card={c} size="xs" />
                        ))}
                      </div>
                      <Badge tone={equityTone(h.equityAtDecision * 100)}>
                        {(h.equityAtDecision * 100).toFixed(0)}%
                      </Badge>
                      <Badge tone="neutral">{STREET_LABEL[h.street] ?? h.street}</Badge>
                      <span className="text-[11px] text-base-muted">
                        {new Date(Number(h.timestamp)).toLocaleDateString("he-IL")}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onUnlinkHand(h.id)}>
                      ביטול קישור
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {unlinkedHands.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <select
                  value={pickedHandId}
                  onChange={(e) => setPickedHandId(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-xs text-base-text outline-none focus:border-accent"
                >
                  <option value="">בחר יד שמורה לקישור…</option>
                  {unlinkedHands.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.heroCards.join(" ")} · {STREET_LABEL[h.street] ?? h.street} ·{" "}
                      {new Date(Number(h.timestamp)).toLocaleDateString("he-IL")}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!pickedHandId}
                  onClick={() => {
                    if (!pickedHandId) return;
                    onLinkHand(pickedHandId);
                    setPickedHandId("");
                  }}
                >
                  קישור
                </Button>
              </div>
            )}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
