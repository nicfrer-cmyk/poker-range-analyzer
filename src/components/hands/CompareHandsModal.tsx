"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge, equityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { ACTION_LABEL } from "@/lib/store/analysisStore";
import { STREET_LABEL, MADE_TIER_LABEL } from "@/lib/labels";
import { mistakeTagOf, MISTAKE_TAG_LABEL, type StoredHand, type MistakeTag } from "@/lib/localHandStore";
import type { StatusTone } from "@/lib/statusTone";

const MISTAKE_TAG_TONE: Record<MistakeTag, StatusTone> = {
  good: "crushing",
  mistake: "risky",
  review: "close",
};

/** Same field, same order, both columns — keeps the two hands visually aligned row-by-row so
 *  differences are easy to scan at a glance. */
const FIELDS: Array<{ label: string; render: (h: StoredHand) => ReactNode }> = [
  {
    label: "קלפי הירו",
    render: (h) => (
      <div className="flex gap-1">
        {h.heroCards.length > 0 ? (
          h.heroCards.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)
        ) : (
          <span className="text-xs text-base-muted">—</span>
        )}
      </div>
    ),
  },
  {
    label: "בורד",
    render: (h) => (
      <div className="flex gap-1">
        {h.board.length > 0 ? (
          h.board.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)
        ) : (
          <span className="text-xs text-base-muted">אין עדיין</span>
        )}
      </div>
    ),
  },
  { label: "פוזיציה", render: (h) => <span className="text-sm">{h.position ?? "?"}</span> },
  {
    label: "רחוב",
    render: (h) => <span className="text-sm">{STREET_LABEL[h.street] ?? h.street}</span>,
  },
  {
    label: "אקוויטי בהחלטה",
    render: (h) => (
      <Badge tone={equityTone(h.equityAtDecision * 100)}>
        {(h.equityAtDecision * 100).toFixed(1)}%
      </Badge>
    ),
  },
  {
    label: "קטגוריית יד",
    render: (h) => (
      <span className="text-sm">
        {h.handCategory
          ? MADE_TIER_LABEL[h.handCategory as keyof typeof MADE_TIER_LABEL] ??
            h.handCategory.replace(/-/g, " ")
          : "—"}
      </span>
    ),
  },
  {
    label: "פעולה שננקטה",
    render: (h) => <span className="text-sm">{ACTION_LABEL[h.actionTaken]}</span>,
  },
  {
    label: "תגית טעות",
    render: (h) => {
      const tag = mistakeTagOf(h);
      return <Badge tone={MISTAKE_TAG_TONE[tag]}>{MISTAKE_TAG_LABEL[tag]}</Badge>;
    },
  },
  {
    label: "הערה",
    render: (h) => <span className="text-sm text-base-muted">{h.note?.trim() || "—"}</span>,
  },
];

function HandColumn({ hand }: { hand: StoredHand }) {
  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-base-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-base-muted">
          {new Date(Number(hand.timestamp)).toLocaleDateString("he-IL")}
        </span>
        <Link href={`/hands/${hand.id}`} className="text-xs text-accent-soft hover:underline">
          פתיחת היד
        </Link>
      </div>
      <dl className="space-y-3">
        {FIELDS.map((field) => (
          <div key={field.label}>
            <dt className="mb-1 text-[11px] text-base-muted">{field.label}</dt>
            <dd>{field.render(hand)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CompareHandsModal({
  hands,
  onClose,
}: {
  hands: [StoredHand, StoredHand];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <Panel className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <PanelHeader>
          <PanelTitle>השוואת ידיים</PanelTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            סגירה
          </Button>
        </PanelHeader>
        <PanelBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <HandColumn hand={hands[0]} />
            <HandColumn hand={hands[1]} />
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              חזרה לרשימה
            </Button>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
