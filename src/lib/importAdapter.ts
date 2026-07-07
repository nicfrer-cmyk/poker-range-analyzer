import type { ParsedHand } from "@/lib/engine/handHistoryParser";
import type { Card } from "@/lib/engine/types";
import type { AnalysisInput } from "@/lib/store/analysisStore";

export function parsedHandToBoard(hand: ParsedHand): Card[] {
  const board: Card[] = [];
  if (hand.board.flop) board.push(...hand.board.flop);
  if (hand.board.turn) board.push(hand.board.turn);
  if (hand.board.river) board.push(hand.board.river);
  return board;
}

/** Maps a parsed hand history into the analyzer's input shape. Villain range defaults to a
 *  wide reasonable guess since hand histories don't reveal opponents' hole cards — the user
 *  can adjust the range manually before analyzing. */
export function parsedHandToAnalysisInput(hand: ParsedHand): Partial<AnalysisInput> {
  const board = parsedHandToBoard(hand);
  return {
    heroCards: (hand.heroCards ?? []) as string[],
    board: board as string[],
    pot: hand.potSize ?? 100,
    toCall: 0,
    villainRangeText: "22+,A2s+,K7s+,Q9s+,J9s+,T8s+,98s,A7o+,KTo+,QJo",
  };
}
