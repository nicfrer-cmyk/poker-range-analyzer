import { cn } from "@/lib/utils/cn";

const SUIT_GLYPH: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
const RED_SUITS = new Set(["h", "d"]);

export type CardSize = "xs" | "sm" | "md" | "lg";

const sizeClasses: Record<CardSize, string> = {
  xs: "w-6 h-8 text-[10px] rounded-[4px]",
  sm: "w-8 h-11 text-xs rounded-[6px]",
  md: "w-12 h-16 text-base rounded-lg",
  lg: "w-16 h-24 text-xl rounded-xl",
};

/** card is a two-character code like "Ah", "Td", "9s" — rank + suit letter. */
export function PlayingCard({
  card,
  size = "md",
  faceDown = false,
  className,
}: {
  card?: string | null;
  size?: CardSize;
  faceDown?: boolean;
  className?: string;
}) {
  if (faceDown || !card) {
    return (
      <div
        className={cn(
          "flex items-center justify-center border border-base-border bg-gradient-to-br from-accent/70 to-accent/40 shadow-soft",
          sizeClasses[size],
          className
        )}
      >
        <span className="text-white/70">♠</span>
      </div>
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1).toLowerCase();
  const isRed = RED_SUITS.has(suit);

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between border border-black/10 bg-white p-1 font-bold shadow-soft",
        isRed ? "text-card-red" : "text-card-black",
        sizeClasses[size],
        className
      )}
    >
      <span className="leading-none">{rank}</span>
      <span className="self-end text-lg leading-none">{SUIT_GLYPH[suit]}</span>
    </div>
  );
}
