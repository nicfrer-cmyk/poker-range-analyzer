import type { Card, Combo } from "@/lib/engine/types";
import { parseRange, removeConflicts } from "@/lib/engine/range";
import { calculateEquity } from "@/lib/engine/equity";
import { isGoodDecision, type DecisionStreet } from "@/lib/engine/leakFinder";
import type { ActionType } from "@/lib/engine/handHistoryParser";
import type { StoredHand } from "@/lib/localHandStore";

/**
 * Hand Replay — walks a saved hand preflop -> its decision street, recomputing hero equity at
 * each step from the board/villain range that's always present on any StoredHand. This works
 * for every hand today, imported or manual, with or without a recorded action sequence: when
 * `streetActions` exists (currently: fresh imports only, see localHandStore.ts) real actions are
 * shown; otherwise the step falls back to an honest equity-only view. Only the hand's actual
 * decision street is graded against `actionTaken`/`evLossEstimate` — every other street is
 * framed as equity education, never as a graded call, to avoid false precision.
 */

const STREET_ORDER: DecisionStreet[] = ["preflop", "flop", "turn", "river"];
const BOARD_LENGTH_FOR_STREET: Record<DecisionStreet, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

const ACTION_TYPE_LABEL_HE: Record<ActionType, string> = {
  "post-sb": "פוסט בליינד קטן",
  "post-bb": "פוסט בליינד גדול",
  post: "פוסט",
  fold: "פולד",
  check: "צ'ק",
  call: "קול",
  bet: "בט",
  raise: "רייז",
  show: "מציג יד",
  muck: "מטמין יד",
  collect: "אוסף קופה",
  unknown: "לא ידוע",
};

export interface ReplayActionView {
  player: string;
  actionLabel: string;
  amount?: number;
}

export interface ReplayStep {
  street: DecisionStreet;
  board: Card[];
  heroEquityPct: number | null;
  isDecisionPoint: boolean;
  actions: ReplayActionView[];
  hasRecordedActions: boolean;
  decision?: {
    actionTaken: StoredHand["actionTaken"];
    evLossEstimate: number;
    isGood: boolean;
  };
}

export function buildReplaySteps(hand: StoredHand): ReplayStep[] {
  if (hand.heroCards.length < 2 || !hand.heroCards[0] || !hand.heroCards[1]) return [];

  const combo: Combo = { c1: hand.heroCards[0] as Card, c2: hand.heroCards[1] as Card };
  const decisionIdx = STREET_ORDER.indexOf(hand.street);
  const streetsToShow = decisionIdx >= 0 ? STREET_ORDER.slice(0, decisionIdx + 1) : [hand.street];

  const rawRange = parseRange(hand.villainRange ?? "");

  return streetsToShow.map((street) => {
    const boardSlice = hand.board.slice(0, BOARD_LENGTH_FOR_STREET[street]) as Card[];
    const dead = [combo.c1, combo.c2, ...boardSlice];
    const villainRange = removeConflicts(rawRange, dead);
    const equity = villainRange.size > 0
      ? calculateEquity({ heroCards: combo, villainRange, board: boardSlice, iterations: 4000 })
      : null;

    const recordedActions = (hand.streetActions ?? []).filter((a) => a.street === street);
    const actions: ReplayActionView[] = recordedActions
      .filter((a) => a.action !== "unknown")
      .map((a) => ({ player: a.player, actionLabel: ACTION_TYPE_LABEL_HE[a.action], amount: a.raiseTo ?? a.amount }));

    const isDecisionPoint = street === hand.street;

    return {
      street,
      board: boardSlice,
      heroEquityPct: equity && !Number.isNaN(equity.heroEquity) ? equity.heroEquity * 100 : null,
      isDecisionPoint,
      actions,
      hasRecordedActions: (hand.streetActions?.length ?? 0) > 0,
      decision: isDecisionPoint
        ? { actionTaken: hand.actionTaken, evLossEstimate: hand.evLossEstimate, isGood: isGoodDecision(hand) }
        : undefined,
    };
  });
}
