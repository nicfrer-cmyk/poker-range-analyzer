"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";

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
 */
export function PaywallModal({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <Panel className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <PanelHeader>
          <PanelTitle>הגעת למגבלת התוכנית החינמית להיום</PanelTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            סגירה
          </Button>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <p className="text-sm text-base-text">{message}</p>
          <p className="text-sm text-base-muted">
            שדרג לפרו לניתוחים ללא הגבלה, או חזור מחר להמשך שימוש בתוכנית החינמית.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <a href="/billing" className="w-full">
              <Button className="w-full">שדרוג לפרו</Button>
            </a>
            <a href="/" className="w-full">
              <Button variant="secondary" className="w-full">
                חזור לדשבורד
              </Button>
            </a>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
