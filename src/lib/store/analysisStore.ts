import { create } from "zustand";
import type { ActionTaken } from "@/lib/engine/leakFinder";

export type Street = "preflop" | "flop" | "turn" | "river";
export type GameType = "cash" | "tournament" | "sng";

export type AnalysisInput = {
  gameType: GameType;
  tableSize: number; // players seated at the table
  smallBlind: number;
  bigBlind: number;
  heroPosition: string;
  villainPosition: string;
  heroCards: string[]; // e.g. ["Ah", "Kd"]
  board: string[]; // 0, 3, 4, or 5 cards
  villainRangeText: string; // e.g. "22+,ATs+,KQo"
  pot: number;
  toCall: number;
  heroStack: number;
  numPlayers: number; // total players still in the hand (for multiway equity share)
  actionTaken: ActionTaken;
  betSize: number;
};

const initialInput: AnalysisInput = {
  gameType: "cash",
  tableSize: 6,
  smallBlind: 1,
  bigBlind: 2,
  heroPosition: "BTN",
  villainPosition: "BB",
  heroCards: [],
  board: [],
  villainRangeText: "22+,ATs+,KQs,AJo+,KQo",
  pot: 100,
  toCall: 50,
  heroStack: 1000,
  numPlayers: 2,
  actionTaken: "call",
  betSize: 0,
};

export function streetFromBoard(board: string[]): Street {
  if (board.length >= 5) return "river";
  if (board.length === 4) return "turn";
  if (board.length === 3) return "flop";
  return "preflop";
}

type AnalysisStore = {
  input: AnalysisInput;
  setHeroCard: (index: 0 | 1, card: string) => void;
  setBoardCard: (index: number, card: string) => void;
  removeBoardCard: (index: number) => void;
  setVillainRangeText: (text: string) => void;
  setField: <K extends keyof AnalysisInput>(key: K, value: AnalysisInput[K]) => void;
  reset: () => void;
  usedCards: () => Set<string>;
};

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  input: initialInput,
  setHeroCard: (index, card) =>
    set((s) => {
      const heroCards = [...s.input.heroCards];
      heroCards[index] = card;
      return { input: { ...s.input, heroCards } };
    }),
  setBoardCard: (index, card) =>
    set((s) => {
      const board = [...s.input.board];
      board[index] = card;
      return { input: { ...s.input, board } };
    }),
  removeBoardCard: (index) =>
    set((s) => {
      const board = s.input.board.filter((_, i) => i !== index);
      return { input: { ...s.input, board } };
    }),
  setVillainRangeText: (text) =>
    set((s) => ({ input: { ...s.input, villainRangeText: text } })),
  setField: (key, value) =>
    set((s) => ({ input: { ...s.input, [key]: value } })),
  reset: () => set({ input: initialInput }),
  usedCards: () => {
    const { heroCards, board } = get().input;
    return new Set([...heroCards, ...board].filter(Boolean));
  },
}));

export const POSITIONS_BY_TABLE_SIZE: Record<number, string[]> = {
  2: ["BTN/SB", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["CO", "BTN", "SB", "BB"],
  5: ["MP", "CO", "BTN", "SB", "BB"],
  6: ["UTG", "MP", "CO", "BTN", "SB", "BB"],
  7: ["UTG", "UTG+1", "MP", "CO", "BTN", "SB", "BB"],
  8: ["UTG", "UTG+1", "MP", "MP+1", "CO", "BTN", "SB", "BB"],
  9: ["UTG", "UTG+1", "MP", "MP+1", "HJ", "CO", "BTN", "SB", "BB"],
};

export const ACTION_LABEL: Record<ActionTaken, string> = {
  fold: "פולד",
  check: "צ'ק",
  call: "קול",
  bet: "הימור",
  raise: "העלאה",
};
