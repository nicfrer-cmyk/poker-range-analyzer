import { cn } from "@/lib/utils/cn";

/** A single pulsing placeholder bar/block — building block for page-level skeleton loaders
 *  (dashboard, hands list, leaks, AI review) so a first data fetch never has to choose between
 *  flashing the "no data yet" empty state or showing nothing at all. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-base-panel2", className)} />;
}

/** A generic "card list is loading" skeleton — `rows` stacked bar-groups inside a Panel-shaped
 *  container, matching the rounded/bordered look of the real content it stands in for. */
export function SkeletonPanelRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-panel border border-base-border bg-base-panel p-4", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-14 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
