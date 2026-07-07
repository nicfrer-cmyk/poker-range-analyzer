"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { NavIcon } from "./NavIcon";
import { cn } from "@/lib/utils/cn";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-base-border bg-base-panel md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="text-xl">♠</span>
        <span className="font-semibold tracking-tight">מנתח טווחי פוקר</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
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
                  ? "bg-accent/10 font-medium text-accent-soft"
                  : "text-base-muted hover:bg-base-panel2 hover:text-base-text"
              )}
            >
              <NavIcon icon={item.icon} className="h-4.5 w-4.5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-[11px] leading-relaxed text-base-muted/80">
        ניתוח פוסט-משחק בלבד. אין סיוע בזמן משחק חי.
      </div>
    </aside>
  );
}
