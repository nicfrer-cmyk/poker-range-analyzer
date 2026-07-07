import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

export function Panel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-panel border border-base-border bg-base-panel shadow-soft",
        className
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-base-border px-4 py-3",
        className
      )}
      {...props}
    />
  );
}

export function PanelTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold text-base-text/90", className)}
      {...props}
    />
  );
}

export function PanelBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
