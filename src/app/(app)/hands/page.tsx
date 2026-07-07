"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { Badge, equityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { listHands, deleteHand, type StoredHand } from "@/lib/localHandStore";
import { MADE_TIER_LABEL } from "@/lib/labels";

const STREET_LABEL: Record<string, string> = {
  preflop: "פרה-פלופ",
  flop: "פלופ",
  turn: "טרן",
  river: "ריבר",
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "ידני",
  imported: "מיובא",
};

export default function HandsLibraryPage() {
  const [hands, setHands] = useState<StoredHand[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setHands(listHands());
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return hands.filter(
      (h) =>
        !q ||
        h.handCategory?.toLowerCase().includes(q) ||
        h.position?.toLowerCase().includes(q) ||
        h.street.includes(q) ||
        h.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [hands, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">ספריית ידיים</h1>
        <div className="flex gap-2">
          <Link href="/hands/import">
            <Button variant="secondary">ייבוא היסטוריה</Button>
          </Link>
          <Link href="/analyze">
            <Button>ניתוח חדש</Button>
          </Link>
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="חיפוש לפי קטגוריה, פוזיציה, רחוב, תגית…"
        className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {filtered.length === 0 ? (
        <Panel>
          <PanelBody className="py-12 text-center text-sm text-base-muted">
            עדיין אין ידיים שמורות. נתח יד ולחץ על &quot;שמור יד&quot; כדי להתחיל לבנות את הספרייה שלך.
          </PanelBody>
        </Panel>
      ) : (
        <div className="space-y-3">
          {filtered.map((h) => (
            <Panel key={h.id}>
              <PanelBody className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {h.heroCards.map((c, i) => (
                      <PlayingCard key={i} card={c} size="sm" />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {h.board.map((c, i) => (
                      <PlayingCard key={i} card={c} size="sm" />
                    ))}
                  </div>
                  <Badge tone={equityTone(h.equityAtDecision * 100)}>
                    {(h.equityAtDecision * 100).toFixed(1)}%
                  </Badge>
                  <Badge tone="neutral">
                    {h.handCategory
                      ? MADE_TIER_LABEL[h.handCategory as keyof typeof MADE_TIER_LABEL] ??
                        h.handCategory.replace(/-/g, " ")
                      : "—"}
                  </Badge>
                  <Badge tone="neutral">{h.position ?? "?"}</Badge>
                  <Badge tone="neutral">{STREET_LABEL[h.street] ?? h.street}</Badge>
                  <Badge tone={h.source === "imported" ? "close" : "neutral"}>
                    {SOURCE_LABEL[h.source] ?? h.source}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    deleteHand(h.id);
                    setHands(listHands());
                  }}
                >
                  מחיקה
                </Button>
              </PanelBody>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
