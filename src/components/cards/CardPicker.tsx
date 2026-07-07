"use client";

import { cn } from "@/lib/utils/cn";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS: { key: string; glyph: string; red: boolean }[] = [
  { key: "s", glyph: "♠", red: false },
  { key: "h", glyph: "♥", red: true },
  { key: "d", glyph: "♦", red: true },
  { key: "c", glyph: "♣", red: false },
];

export function CardPicker({
  usedCards,
  onPick,
  className,
}: {
  usedCards: Set<string>;
  onPick: (card: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {SUITS.map((suit) => (
        <div key={suit.key} className="flex gap-1.5">
          {RANKS.map((rank) => {
            const code = `${rank}${suit.key}`;
            const used = usedCards.has(code);
            return (
              <button
                key={code}
                type="button"
                disabled={used}
                onClick={() => onPick(code)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition-colors",
                  used
                    ? "cursor-not-allowed border-base-border/50 bg-base-panel2/40 text-base-muted/30"
                    : "border-base-border bg-base-panel2 hover:border-accent hover:bg-accent/10",
                  !used && suit.red ? "text-card-red" : !used ? "text-base-text" : ""
                )}
                title={code}
              >
                <span className="leading-none">
                  {rank}
                  <span className="ms-px">{suit.glyph}</span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
