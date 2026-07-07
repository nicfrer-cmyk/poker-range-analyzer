"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { Badge, equityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PlayingCard } from "@/components/cards/PlayingCard";
import {
  listHands,
  deleteHand,
  updateHand,
  mistakeTagOf,
  MISTAKE_TAG_LABEL,
  exportHandsAsJson,
  exportHandsAsCsv,
  downloadTextFile,
  type StoredHand,
  type MistakeTag,
} from "@/lib/localHandStore";
import { MADE_TIER_LABEL } from "@/lib/labels";
import type { StatusTone } from "@/lib/statusTone";

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

const MISTAKE_TAG_TONE: Record<MistakeTag, StatusTone> = {
  good: "crushing",
  mistake: "risky",
  review: "close",
};

type TagFilter = "all" | MistakeTag;
type StreetFilter = "all" | "preflop" | "flop" | "turn" | "river";

export default function HandsLibraryPage() {
  const [hands, setHands] = useState<StoredHand[]>([]);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [streetFilter, setStreetFilter] = useState<StreetFilter>("all");
  const [minEquity, setMinEquity] = useState(0);
  const [maxEquity, setMaxEquity] = useState(100);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setHands(listHands());
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return hands.filter((h) => {
      if (
        q &&
        !(
          h.handCategory?.toLowerCase().includes(q) ||
          h.position?.toLowerCase().includes(q) ||
          h.street.includes(q) ||
          h.tags.some((t) => t.toLowerCase().includes(q))
        )
      ) {
        return false;
      }
      if (tagFilter !== "all" && mistakeTagOf(h) !== tagFilter) return false;
      if (streetFilter !== "all" && h.street !== streetFilter) return false;
      const equityPct = h.equityAtDecision * 100;
      if (equityPct < minEquity || equityPct > maxEquity) return false;
      return true;
    });
  }, [hands, query, tagFilter, streetFilter, minEquity, maxEquity]);

  const startEditingNote = (h: StoredHand) => {
    setExpandedId(h.id);
    setNoteDrafts((prev) => ({ ...prev, [h.id]: prev[h.id] ?? h.note ?? "" }));
  };

  const saveNote = (id: string) => {
    updateHand(id, { note: noteDrafts[id] ?? "" });
    setHands(listHands());
    setExpandedId(null);
  };

  const handleExportJson = () => {
    downloadTextFile("hands.json", exportHandsAsJson(filtered), "application/json");
  };

  const handleExportCsv = () => {
    downloadTextFile("hands.csv", exportHandsAsCsv(filtered), "text/csv");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">ספריית ידיים</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportJson}>
            ייצוא JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportCsv}>
            ייצוא CSV
          </Button>
          <Link href="/hands/import">
            <Button variant="secondary">ייבוא היסטוריה</Button>
          </Link>
          <Link href="/analyze">
            <Button>ניתוח חדש</Button>
          </Link>
        </div>
      </div>

      <Panel>
        <PanelBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 space-y-1">
            <label className="text-xs text-base-muted">חיפוש</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי קטגוריה, פוזיציה, רחוב, תגית…"
              className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-base-muted">תגית</label>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value as TagFilter)}
              className="rounded-lg border border-base-border bg-base-panel2 px-2.5 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="all">הכול</option>
              <option value="good">{MISTAKE_TAG_LABEL.good}</option>
              <option value="mistake">{MISTAKE_TAG_LABEL.mistake}</option>
              <option value="review">{MISTAKE_TAG_LABEL.review}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-base-muted">רחוב</label>
            <select
              value={streetFilter}
              onChange={(e) => setStreetFilter(e.target.value as StreetFilter)}
              className="rounded-lg border border-base-border bg-base-panel2 px-2.5 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="all">הכול</option>
              <option value="preflop">{STREET_LABEL.preflop}</option>
              <option value="flop">{STREET_LABEL.flop}</option>
              <option value="turn">{STREET_LABEL.turn}</option>
              <option value="river">{STREET_LABEL.river}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-base-muted">אקוויטי מינ&apos; %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={minEquity}
              onChange={(e) => setMinEquity(Number(e.target.value) || 0)}
              className="w-20 rounded-lg border border-base-border bg-base-panel2 px-2.5 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-base-muted">אקוויטי מקס&apos; %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={maxEquity}
              onChange={(e) => setMaxEquity(Number(e.target.value) || 0)}
              className="w-20 rounded-lg border border-base-border bg-base-panel2 px-2.5 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          {(tagFilter !== "all" || streetFilter !== "all" || minEquity !== 0 || maxEquity !== 100 || query) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setTagFilter("all");
                setStreetFilter("all");
                setMinEquity(0);
                setMaxEquity(100);
              }}
            >
              איפוס סינון
            </Button>
          )}
        </PanelBody>
      </Panel>

      {filtered.length === 0 ? (
        <Panel>
          <PanelBody className="py-12 text-center text-sm text-base-muted">
            {hands.length === 0
              ? 'עדיין אין ידיים שמורות. נתח יד ולחץ על "שמור יד" כדי להתחיל לבנות את הספרייה שלך.'
              : "אין ידיים שתואמות את הסינון הנוכחי."}
          </PanelBody>
        </Panel>
      ) : (
        <div className="space-y-3">
          {filtered.map((h) => {
            const tag = mistakeTagOf(h);
            const isExpanded = expandedId === h.id;
            return (
              <Panel key={h.id}>
                <PanelBody className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
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
                      <Badge tone={MISTAKE_TAG_TONE[tag]}>{MISTAKE_TAG_LABEL[tag]}</Badge>
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
                    <div className="flex gap-2">
                      <Link href={`/hands/${h.id}`}>
                        <Button size="sm" variant="secondary">
                          צפייה חוזרת
                        </Button>
                      </Link>
                      <Button size="sm" variant="secondary" onClick={() => startEditingNote(h)}>
                        {h.note ? "עריכת הערה" : "הוספת הערה"}
                      </Button>
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
                    </div>
                  </div>

                  {h.note && !isExpanded && (
                    <p className="rounded-lg bg-base-panel2 p-2 text-xs text-base-muted">{h.note}</p>
                  )}

                  {isExpanded && (
                    <div className="space-y-2 rounded-lg border border-base-border p-3">
                      <textarea
                        value={noteDrafts[h.id] ?? ""}
                        onChange={(e) =>
                          setNoteDrafts((prev) => ({ ...prev, [h.id]: e.target.value }))
                        }
                        rows={3}
                        placeholder="מה למדת מהיד הזו? מה כדאי לשים לב אליו בפעם הבאה?"
                        className="w-full rounded-lg border border-base-border bg-base-panel2 p-2 text-sm outline-none focus:border-accent"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveNote(h.id)}>
                          שמירת הערה
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setExpandedId(null)}>
                          ביטול
                        </Button>
                      </div>
                    </div>
                  )}
                </PanelBody>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
