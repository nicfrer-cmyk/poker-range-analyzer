import { cn } from "@/lib/utils/cn";

const STEP_LABELS = ["סוג משחק", "קלפים", "קופה והחלטה", "טווח היריב", "תוצאה"];

export function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div key={label} className="flex shrink-0 items-center gap-1.5">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                active
                  ? "bg-accent text-white"
                  : done
                  ? "bg-status-ahead/15 text-status-ahead"
                  : "bg-base-panel2 text-base-muted"
              )}
            >
              {done ? "✓" : n}
            </div>
            <span
              className={cn(
                "text-xs whitespace-nowrap",
                active ? "font-medium text-base-text" : "text-base-muted"
              )}
            >
              {label}
            </span>
            {n < STEP_LABELS.length && <span className="mx-1 text-base-border">—</span>}
          </div>
        );
      })}
    </div>
  );
}
