import type { StoredHand } from "@/lib/localHandStore";

const STREET_LABEL: Record<string, string> = {
  preflop: "פרה-פלופ",
  flop: "פלופ",
  turn: "טרן",
  river: "ריבר",
};

/** Builds a plain-text hand description for the AI review prompt. */
export function buildHandSummary(hand: StoredHand): string {
  const lines = [
    `קלפי Hero: ${hand.heroCards.join(" ")}`,
    hand.board.length ? `בורד: ${hand.board.join(" ")}` : "בורד: פרה-פלופ (אין קלפים משותפים עדיין)",
    hand.position ? `פוזיציית Hero: ${hand.position}` : null,
    `רחוב ההחלטה: ${STREET_LABEL[hand.street] ?? hand.street}`,
    `גודל הקופה: ${hand.potSize}`,
    `טווח משוער של היריב: ${hand.villainRange ?? "לא צוין"}`,
    `אקוויטי בנקודת ההחלטה: ${(hand.equityAtDecision * 100).toFixed(1)}%`,
    `הפעולה שבוצעה: ${hand.actionTaken}`,
    hand.handCategory ? `קטגוריית היד: ${hand.handCategory}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}
