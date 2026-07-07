"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { Badge, equityTone } from "@/components/ui/Badge";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { HandReplayPlayer } from "@/components/replay/HandReplayPlayer";
import { PostGameNotice } from "@/components/layout/PostGameNotice";
import { decodeSharedHand } from "@/lib/shareHand";
import { mistakeTagOf, MISTAKE_TAG_LABEL, type MistakeTag } from "@/lib/localHandStore";
import { STREET_LABEL, MADE_TIER_LABEL } from "@/lib/labels";
import { ACTION_LABEL } from "@/lib/store/analysisStore";
import type { StatusTone } from "@/lib/statusTone";

const MISTAKE_TAG_TONE: Record<MistakeTag, StatusTone> = {
  good: "crushing",
  mistake: "risky",
  review: "close",
};

/** Public, read-only view of a single hand shared via a self-contained link (see
 *  src/lib/shareHand.ts — the entire payload lives in the URL itself, there is no server lookup).
 *  Reachable without auth: `/shared` is already listed in PUBLIC_PATH_PREFIXES in
 *  src/lib/supabase/middleware.ts. Rendered outside the `(app)` route group, so it doesn't get
 *  AppShell — the PostGameNotice normally shown there is repeated here explicitly. */
export default function SharedHandPage() {
  const params = useParams<{ data: string }>();
  const hand = useMemo(() => decodeSharedHand(params.data), [params.data]);

  if (!hand) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Panel className="w-full max-w-md">
          <PanelBody className="space-y-4 py-10 text-center">
            <p className="text-sm text-base-muted">קישור השיתוף אינו תקין, פגום, או שפג תוקפו.</p>
            <Link href="/" className="text-sm text-accent-soft hover:underline">
              מעבר למנתח טווחי פוקר
            </Link>
          </PanelBody>
        </Panel>
      </div>
    );
  }

  const tag = mistakeTagOf(hand);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <PostGameNotice />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">יד משותפת</h1>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">צפייה בלבד</Badge>
          <Link href="/" className="text-xs text-accent-soft hover:underline">
            מעבר למנתח טווחי פוקר
          </Link>
        </div>
      </div>

      <Panel>
        <PanelBody className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <p className="text-xs text-base-muted">קלפי הירו</p>
            <div className="flex gap-1">
              {hand.heroCards.map((c, i) => (
                <PlayingCard key={i} card={c} size="md" />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-base-muted">בורד</p>
            <div className="flex gap-1">
              {hand.board.length > 0 ? (
                hand.board.map((c, i) => <PlayingCard key={i} card={c} size="md" />)
              ) : (
                <span className="text-xs text-base-muted">אין עדיין</span>
              )}
            </div>
          </div>
          <Badge tone={equityTone(hand.equityAtDecision * 100)}>
            {(hand.equityAtDecision * 100).toFixed(1)}%
          </Badge>
          <Badge tone="neutral">
            {hand.handCategory
              ? MADE_TIER_LABEL[hand.handCategory as keyof typeof MADE_TIER_LABEL] ?? hand.handCategory
              : "—"}
          </Badge>
          <Badge tone="neutral">{hand.position ?? "?"}</Badge>
          <Badge tone="neutral">{STREET_LABEL[hand.street] ?? hand.street}</Badge>
          <Badge tone="neutral">{ACTION_LABEL[hand.actionTaken]}</Badge>
          <Badge tone={MISTAKE_TAG_TONE[tag]}>{MISTAKE_TAG_LABEL[tag]}</Badge>
        </PanelBody>
      </Panel>

      {hand.note && (
        <Panel>
          <PanelBody className="text-sm text-base-text">הערה: {hand.note}</PanelBody>
        </Panel>
      )}

      <HandReplayPlayer hand={hand} />
    </div>
  );
}
