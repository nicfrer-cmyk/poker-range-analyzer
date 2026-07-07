import { create } from "zustand";

export type Street = "preflop" | "flop" | "turn" | "river";

export type AnalysisInput = {
  heroCards: string[]; // e.g. ["Ah", "Kd"]
  board: string[]; // 0, 3, 4, or 5 cards
  villainRangeText: string; // e.g. "22+,ATs+,KQo"
  pot: number;
  toCall: number;
  heroStack: number;
  numPlayers: number; // total players still in the hand (for multiway equity share)
};

const initialInput: AnalysisInput = {
  heroCards: [],
  board: [],
  villainRangeText: "22+,ATs+,KQs,AJo+,KQo",
  pot: 100,
  toCall: 50,
  heroStack: 1000,
  numPlayers: 2,
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
