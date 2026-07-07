"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Optional click-to-inspect affordance, independent of `onToggle`/selection. Fires on a plain
   *  click of a cell regardless of builder mode — used by read-only heatmap instances (e.g. the
   *  Range Explorer) that want a click to open a detail view instead of toggling selection. */
  onCellClick?: (label: string) => void;
  onTooltip?: (label: string) => string | undefined;
  className?: string;
};

export function RangeMatrix({
  selected,
  equities,
  onToggle,
  onCellClick,
  onTooltip,
  className,
}: RangeMatrixProps) {
  const draggingRef = useRef(false);
  const dragAddRef = useRef(true);
  const lastTouchRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Touch drag-paint: touchmove doesn't fire mouseenter on the elements a finger slides over,
  // so we track the finger position ourselves. Attached as a native listener (not the React
  // onTouchMove prop) because React registers touchmove as passive by default, which would make
  // preventDefault() below a silent no-op and let the page scroll mid-paint.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchMove = (event: TouchEvent) => {
      if (!draggingRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const label = (target as HTMLElement | null)?.closest<HTMLElement>("[data-label]")
        ?.dataset.label;
      if (label) dragOver(label);
      // Only block the page scroll once a paint gesture is actually underway.
      event.preventDefault();
    };

    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => container.removeEventListener("touchmove", handleTouchMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, onToggle]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "grid select-none grid-cols-[repeat(13,minmax(0,1fr))] gap-[3px]",
        className
      )}
      onMouseUp={() => (draggingRef.current = false)}
      onMouseLeave={() => (draggingRef.current = false)}
      onTouchEnd={() => (draggingRef.current = false)}
      onTouchCancel={() => (draggingRef.current = false)}
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
              data-label={label}
              onMouseDown={() => {
                // Ignore the synthetic mousedown mobile browsers fire after a real touch tap,
                // which would otherwise toggle the cell a second time right after touchstart did.
                if (Date.now() - lastTouchRef.current < 500) return;
                beginDrag(label);
              }}
              onMouseEnter={() => {
                setHovered(label);
                dragOver(label);
              }}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => {
                lastTouchRef.current = Date.now();
                beginDrag(label);
              }}
              onClick={() => onCellClick?.(label)}
              title={onTooltip?.(label)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-[3px] text-[9px] font-medium leading-none transition-transform hover:z-10 hover:scale-110 sm:text-[10px]",
                onCellClick && "cursor-pointer",
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
