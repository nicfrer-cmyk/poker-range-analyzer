"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge, equityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HandReplayPlayer } from "@/components/replay/HandReplayPlayer";
import { RangeMatrix } from "@/components/range/RangeMatrix";
import { RangeExplorerPanel } from "@/components/range/RangeExplorerPanel";
import { getHand, mistakeTagOf, MISTAKE_TAG_LABEL, type StoredHand } from "@/lib/localHandStore";
import { STREET_LABEL, MADE_TIER_LABEL } from "@/lib/labels";
import { computeMatrixEquities } from "@/lib/analysisEngine";
import { parseRange, removeConflicts } from "@/lib/engine/range";
import type { Card, Combo } from "@/lib/engine/types";
import { buildShareUrl } from "@/lib/shareHand";

export default function HandDetailPage() {
  const params = useParams<{ id: string }>();
  const [hand, setHand] = useState<StoredHand | null | undefined>(undefined);
  const [showRangeExplorer, setShowRangeExplorer] = useState(false);
  const [computingMatrix, setComputingMatrix] = useState(false);
  const [matrixEquities, setMatrixEquities] = useState<Record<string, number>>({});
  const [selectedComboLabel, setSelectedComboLabel] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

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

  const heroCombo: Combo | null =
    hand.heroCards.length >= 2 && hand.heroCards[0] && hand.heroCards[1]
      ? { c1: hand.heroCards[0] as Card, c2: hand.heroCards[1] as Card }
      : null;
  const canExploreRange = !!heroCombo && !!hand.villainRange;

  const handleShare = async () => {
    const url = buildShareUrl(hand);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API can fail (missing permission, non-secure context, ...) — fall back to a
      // prompt so the link is still reachable instead of silently doing nothing.
      window.prompt("העתקת הקישור:", url);
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const handleShowRangeExplorer = () => {
    if (!heroCombo || !hand.villainRange) return;
    setShowRangeExplorer(true);
    setComputingMatrix(true);
    // Deferred a tick so the "computing" state actually paints before the ~169-cell equity
    // sweep runs synchronously — mirrors the analyze page's deep-analysis pattern.
    setTimeout(() => {
      const villainRange = removeConflicts(parseRange(hand.villainRange as string), [
        ...hand.heroCards,
        ...hand.board,
      ]);
      setMatrixEquities(computeMatrixEquities(heroCombo, hand.board, villainRange));
      setComputingMatrix(false);
    }, 30);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">פרטי יד</h1>
        <div className="flex flex-wrap items-center gap-2">
          {shareCopied && <span className="text-xs text-status-ahead">הקישור הועתק</span>}
          <Button variant="secondary" size="sm" onClick={handleShare}>
            שיתוף
          </Button>
          <Link href="/hands">
            <Button variant="secondary" size="sm">
              חזרה לספרייה
            </Button>
          </Link>
        </div>
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

      <Panel>
        <PanelHeader>
          <PanelTitle>חקירת טווח היריב</PanelTitle>
          {!showRangeExplorer && canExploreRange && (
            <Button size="sm" variant="secondary" onClick={handleShowRangeExplorer}>
              הצג מטריצת טווח
            </Button>
          )}
        </PanelHeader>
        <PanelBody>
          {!canExploreRange ? (
            <p className="py-4 text-center text-sm text-base-muted">
              אין מספיק נתונים (קלפי הירו וטווח יריב) כדי להציג מטריצת טווח עבור יד זו.
            </p>
          ) : !showRangeExplorer ? (
            <p className="text-sm text-base-muted">
              הצג את טווח היריב כמטריצה אינטראקטיבית — לחיצה על כל קומבינציה פותחת חקירה מעמיקה
              שלה מול הקלפים והבורד של היד הזו.
            </p>
          ) : computingMatrix ? (
            <p className="py-8 text-center text-sm text-base-muted">מחשב אקוויטי לכל קומבינציה…</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-base-muted">
                לחיצה על קומבינציה פותחת חקירה מעמיקה שלה מול הידיים שלך.
              </p>
              <RangeMatrix equities={matrixEquities} onCellClick={setSelectedComboLabel} />
            </>
          )}
        </PanelBody>
      </Panel>

      {selectedComboLabel && heroCombo && (
        <RangeExplorerPanel
          label={selectedComboLabel}
          heroCombo={heroCombo}
          board={hand.board}
          onClose={() => setSelectedComboLabel(null)}
        />
      )}
    </div>
  );
}
