"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { NavIcon } from "./NavIcon";
import { cn } from "@/lib/utils/cn";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-base-border md:bg-base-panel/60 md:backdrop-blur-sm">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="text-xl">♠</span>
        <span className="font-semibold tracking-tight">Poker Range Analyzer</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-accent/15 text-base-text"
                  : "text-base-muted hover:bg-base-panel2 hover:text-base-text"
              )}
            >
              <NavIcon icon={item.icon} className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-[11px] text-base-muted/70">
        Post-game analysis only. No live-play assistance.
      </div>
    </aside>
  );
}
