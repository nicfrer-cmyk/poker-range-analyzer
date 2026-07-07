"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { equityTone } from "@/components/ui/Badge";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

export function cellLabel(rowRank: string, colRank: string): string {
  if (rowRank === colRank) return `${rowRank}${colRank}`;
  const rowIdx = RANKS.indexOf(rowRank);
  const colIdx = RANKS.indexOf(colRank);
  // upper-right triangle (row before col in rank order) = suited
  return rowIdx < colIdx ? `${rowRank}${colRank}s` : `${colRank}${rowRank}o`;
}

const toneClasses: Record<string, string> = {
  crushing: "bg-status-crushing text-white",
  ahead: "bg-status-ahead/90 text-white",
  close: "bg-status-close/90 text-black/80",
  risky: "bg-status-risky/90 text-black/80",
  behind: "bg-status-behind/90 text-white",
  neutral: "bg-base-panel2 text-base-muted",
};

export type RangeMatrixProps = {
  /** builder mode: which cells are selected (weight 0-1, 1 = fully in range) */
  selected?: Record<string, number>;
  /** heatmap mode: equity 0-100 per cell, overrides selection styling */
  equities?: Record<string, number>;
  onToggle?: (label: string) => void;
  onTooltip?: (label: string) => string | undefined;
  className?: string;
};

export function RangeMatrix({
  selected,
  equities,
  onToggle,
  onTooltip,
  className,
}: RangeMatrixProps) {
  const draggingRef = useRef(false);
  const dragAddRef = useRef(true);
  const [hovered, setHovered] = useState<string | null>(null);

  const beginDrag = (label: string) => {
    if (!onToggle) return;
    draggingRef.current = true;
    dragAddRef.current = !((selected?.[label] ?? 0) > 0);
    onToggle(label);
  };

  const dragOver = (label: string) => {
    if (!draggingRef.current || !onToggle) return;
    const isOn = (selected?.[label] ?? 0) > 0;
    if (isOn !== dragAddRef.current) onToggle(label);
  };

  return (
    <div
      className={cn(
        "grid select-none grid-cols-[repeat(13,minmax(0,1fr))] gap-[3px]",
        className
      )}
      onMouseUp={() => (draggingRef.current = false)}
      onMouseLeave={() => (draggingRef.current = false)}
    >
      {RANKS.map((rowRank) =>
        RANKS.map((colRank) => {
          const label = cellLabel(rowRank, colRank);
          const equity = equities?.[label];
          const weight = selected?.[label] ?? 0;
          const tone = equity !== undefined ? equityTone(equity) : undefined;

          return (
            <button
              key={label}
              type="button"
              onMouseDown={() => beginDrag(label)}
              onMouseEnter={() => {
                setHovered(label);
                dragOver(label);
              }}
              onMouseLeave={() => setHovered(null)}
              title={onTooltip?.(label)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-[3px] text-[9px] font-medium leading-none transition-transform hover:z-10 hover:scale-110 sm:text-[10px]",
                tone
                  ? toneClasses[tone]
                  : weight > 0
                  ? "bg-accent text-white"
                  : "bg-base-panel2 text-base-muted/60",
                hovered === label && "ring-1 ring-accent-soft"
              )}
              style={
                !tone && weight > 0 && weight < 1
                  ? { opacity: 0.35 + weight * 0.65 }
                  : undefined
              }
            >
              {label}
            </button>
          );
        })
      )}
    </div>
  );
}
