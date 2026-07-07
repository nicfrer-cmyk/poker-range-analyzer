import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";
import { equityTone, type StatusTone } from "@/lib/statusTone";

export type { StatusTone };
export { equityTone };

const toneClasses: Record<StatusTone, string> = {
  crushing: "bg-status-crushing/20 text-status-crushing border-status-crushing/40",
  ahead: "bg-status-ahead/20 text-status-ahead border-status-ahead/40",
  close: "bg-status-close/20 text-status-close border-status-close/40",
  risky: "bg-status-risky/20 text-status-risky border-status-risky/40",
  behind: "bg-status-behind/20 text-status-behind border-status-behind/40",
  neutral: "bg-base-panel2 text-base-muted border-base-border",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
