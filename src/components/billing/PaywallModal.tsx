"use client";

import { useEffect } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics";

/**
 * Hard-block paywall moment for Free-plan users who just hit a daily usage limit (as opposed to
 * the existing `isNearLimit`-driven Badge, which is a gentle "almost there" nudge shown *before*
 * the block). `message` is the specific `gate.reason` string from `canPerformAction` (e.g. quick
 * vs. advanced analysis wording) rather than a hardcoded generic headline, so the copy always
 * matches which limit was actually hit.
 *
 * Follows `OpponentFormModal`'s overlay pattern (fixed inset-0 backdrop + centered Panel, click
 * backdrop to dismiss). Uses z-50 to match the app's other modals (`OpponentFormModal`,
 * `RangeExplorerPanel`) — see the z-index map documented in `ResultsSummaryBar.tsx`.
 *
 * `title`/`primaryLabel`/`secondaryLabel`/`onSecondaryClick`/`hideFooterNote` are all optional
 * and default to the original daily-limit-block copy/behavior (title "הגעת למגבלת התוכנית
 * החינמית להיום", secondary button navigates to "/"), so the existing daily-limit call sites in
 * `analyze/page.tsx` and `QuickAnalysis.tsx` are unaffected. They exist so richer "value moment"
 * triggers (e.g. leak finder / weekly report / AI review upsells) can show a distinct headline
 * and a "continue on Free" secondary action that just dismisses the modal instead of navigating
 * away — pass `onSecondaryClick` (even a no-op) to opt into that dismiss-only behavior.
 */
export function PaywallModal({
  open,
  message,
  onClose,
  title = "הגעת למגבלת התוכנית החינמית להיום",
  primaryLabel = "שדרוג לפרו",
  secondaryLabel = "חזור לדשבורד",
  onSecondaryClick,
  hideFooterNote = false,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
  title?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  /** If provided, the secondary button calls this then closes the modal instead of navigating to "/". */
  onSecondaryClick?: () => void;
  /** Hides the generic "שדרג לפרו לניתוחים ללא הגבלה..." footer line — useful when `message` already covers it. */
  hideFooterNote?: boolean;
}) {
  // Fires once each time the modal actually opens (transitions to `open === true`), not on
  // every render — mirrors the `open`-gated early return just below.
  useEffect(() => {
    if (open) track("paywall_viewed", { message });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleSecondary = () => {
    onSecondaryClick?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <Panel className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <PanelHeader>
          <PanelTitle>{title}</PanelTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            סגירה
          </Button>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <p className="text-sm text-base-text">{message}</p>
          {!hideFooterNote && (
            <p className="text-sm text-base-muted">
              שדרג לפרו לניתוחים ללא הגבלה, או חזור מחר להמשך שימוש בתוכנית החינמית.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <a
              href="/billing"
              className="w-full"
              onClick={() => track("upgrade_clicked", { source: "paywall_modal" })}
            >
              <Button className="w-full">{primaryLabel}</Button>
            </a>
            {onSecondaryClick ? (
              <Button variant="secondary" className="w-full" onClick={handleSecondary}>
                {secondaryLabel}
              </Button>
            ) : (
              <a href="/" className="w-full">
                <Button variant="secondary" className="w-full">
                  {secondaryLabel}
                </Button>
              </a>
            )}
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
