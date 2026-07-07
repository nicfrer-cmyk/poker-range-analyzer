"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge, equityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { computeSessionStats, topLeaks } from "@/lib/engine/leakFinder";
import { MADE_TIER_LABEL } from "@/lib/labels";

const STREET_LABEL: Record<string, string> = {
  preflop: "פרה-פלופ",
  flop: "פלופ",
  turn: "טרן",
  river: "ריבר",
};

const DIMENSION_LABEL: Record<string, string> = {
  position: "פוזיציה",
  handCategory: "קטגוריית יד",
  street: "רחוב",
  potSizeBucket: "גודל הפוט",
};

function formatLeakKey(dimension: string, key: string): string {
  if (dimension === "handCategory") {
    return MADE_TIER_LABEL[key as keyof typeof MADE_TIER_LABEL] ?? key;
  }
  if (dimension === "street") return STREET_LABEL[key] ?? key;
  if (dimension === "potSizeBucket") {
    return key.replace("small", "נמוך").replace("medium", "בינוני").replace("large", "גבוה");
  }
  return key;
}

export default function DashboardPage() {
  const [hands, setHands] = useState<StoredHand[]>([]);

  useEffect(() => {
    setHands(listHands());
  }, []);

  const stats = useMemo(() => computeSessionStats(hands), [hands]);
  const leaks = useMemo(() => topLeaks(hands, 3), [hands]);
  const recent = hands.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ברוך שובך</h1>
        <p className="mt-1 text-sm text-base-muted">
          ניתוח לאחר המשחק בלבד — בחר יד, ראה איפה עמדת, ולמד מה לעשות אחרת בפעם הבאה.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/analyze">
          <Button>ניתוח חדש</Button>
        </Link>
        <Link href="/hands/import">
          <Button variant="secondary">ייבוא היסטוריית ידיים</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">ידיים שנותחו</p>
            <p className="text-2xl font-bold">{stats.handCount}</p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">אקוויטי ממוצע</p>
            <p className="text-2xl font-bold">
              {stats.handCount ? `${(stats.avgEquity * 100).toFixed(1)}%` : "—"}
            </p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">החלטות טובות</p>
            <p className="text-2xl font-bold text-status-ahead">
              {stats.handCount ? `${(stats.goodDecisionRate * 100).toFixed(0)}%` : "—"}
            </p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">דליפות מובילות שנמצאו</p>
            <p className="text-2xl font-bold text-status-behind">{leaks.length}</p>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>ניתוחים אחרונים</PanelTitle>
            <Link href="/hands" className="text-xs text-accent-soft">
              לכל הידיים
            </Link>
          </PanelHeader>
          <PanelBody className="space-y-3">
            {recent.length === 0 ? (
              <p className="text-sm text-base-muted">עדיין אין ידיים — הרץ את הניתוח הראשון שלך.</p>
            ) : (
              recent.map((h) => (
                <div key={h.id} className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {h.heroCards.map((c, i) => (
                      <PlayingCard key={i} card={c} size="xs" />
                    ))}
                  </div>
                  <Badge tone={equityTone(h.equityAtDecision * 100)}>
                    {(h.equityAtDecision * 100).toFixed(0)}%
                  </Badge>
                  <span className="text-xs text-base-muted">
                    {h.handCategory ? formatLeakKey("handCategory", h.handCategory) : "—"} ·{" "}
                    {STREET_LABEL[h.street] ?? h.street}
                  </span>
                </div>
              ))
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>דליפות מובילות</PanelTitle>
            <Link href="/session" className="text-xs text-accent-soft">
              דוח מלא
            </Link>
          </PanelHeader>
          <PanelBody className="space-y-2">
            {leaks.length === 0 ? (
              <p className="text-sm text-base-muted">
                שמור עוד כמה ידיים כדי לפתוח את גילוי הדליפות.
              </p>
            ) : (
              leaks.map((leak) => (
                <div
                  key={`${leak.dimension}-${leak.key}`}
                  className="flex items-center justify-between rounded-lg border border-base-border px-3 py-2"
                >
                  <span className="text-sm">
                    {DIMENSION_LABEL[leak.dimension] ?? leak.dimension}:{" "}
                    <b>{formatLeakKey(leak.dimension, leak.key)}</b>
                  </span>
                  <span className="text-xs text-base-muted">{leak.count} ידיים</span>
                </div>
              ))
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>כלים נוספים</PanelTitle>
        </PanelHeader>
        <PanelBody className="flex flex-wrap gap-2">
          {[
            { href: "/range-vs-range", label: "טווח מול טווח" },
            { href: "/icm", label: "מחשבון ICM" },
            { href: "/ai-review", label: "ניתוח יד עם AI" },
            { href: "/bankroll", label: "מעקב בנקרול" },
          ].map((tool) => (
            <Link key={tool.href} href={tool.href}>
              <Button variant="secondary" size="sm">
                {tool.label}
              </Button>
            </Link>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}
