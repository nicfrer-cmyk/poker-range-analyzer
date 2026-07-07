"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { NavIcon } from "./NavIcon";
import { cn } from "@/lib/utils/cn";

export function BottomNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => i.mobile);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 w-full border-t border-base-border bg-base-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 py-2.5"
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  active ? "bg-accent/10 text-accent-soft" : "text-base-muted"
                )}
              >
                <NavIcon icon={item.icon} className="h-5 w-5" />
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none",
                  active ? "font-medium text-accent-soft" : "text-base-muted"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
