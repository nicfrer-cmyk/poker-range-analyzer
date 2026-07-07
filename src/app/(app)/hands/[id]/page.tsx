"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { Badge, equityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HandReplayPlayer } from "@/components/replay/HandReplayPlayer";
import { getHand, mistakeTagOf, MISTAKE_TAG_LABEL, type StoredHand } from "@/lib/localHandStore";
import { STREET_LABEL, MADE_TIER_LABEL } from "@/lib/labels";

export default function HandDetailPage() {
  const params = useParams<{ id: string }>();
  const [hand, setHand] = useState<StoredHand | null | undefined>(undefined);

  useEffect(() => {
    setHand(getHand(params.id) ?? null);
  }, [params.id]);

  if (hand === undefined) return null;

  if (hand === null) {
    return (
      <div className="space-y-4">
        <Panel>
          <PanelBody className="py-10 text-center text-sm text-base-muted">
            היד לא נמצאה. אולי היא נמחקה?
          </PanelBody>
        </Panel>
        <div className="flex justify-center">
          <Link href="/hands">
            <Button variant="secondary">חזרה לספריית ידיים</Button>
          </Link>
        </div>
      </div>
    );
  }

  const tag = mistakeTagOf(hand);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">פרטי יד</h1>
        <Link href="/hands">
          <Button variant="secondary" size="sm">
            חזרה לספרייה
          </Button>
        </Link>
      </div>

      <Panel>
        <PanelBody className="flex flex-wrap items-center gap-2">
          <Badge tone={equityTone(hand.equityAtDecision * 100)}>{(hand.equityAtDecision * 100).toFixed(1)}%</Badge>
          <Badge tone="neutral">
            {hand.handCategory ? MADE_TIER_LABEL[hand.handCategory as keyof typeof MADE_TIER_LABEL] ?? hand.handCategory : "—"}
          </Badge>
          <Badge tone="neutral">{hand.position ?? "?"}</Badge>
          <Badge tone="neutral">{STREET_LABEL[hand.street] ?? hand.street}</Badge>
          <Badge tone={tag === "good" ? "crushing" : tag === "mistake" ? "risky" : "close"}>
            {MISTAKE_TAG_LABEL[tag]}
          </Badge>
          {hand.note && <span className="text-xs text-base-muted">הערה: {hand.note}</span>}
        </PanelBody>
      </Panel>

      <HandReplayPlayer hand={hand} />
    </div>
  );
}
