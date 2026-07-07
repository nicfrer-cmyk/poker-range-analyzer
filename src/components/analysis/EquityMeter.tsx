"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { equityTone } from "@/components/ui/Badge";
import { useTheme } from "@/lib/useTheme";

// Mirrors the --color-status-* CSS variables in globals.css for each theme, since these need
// to be plain rgb() strings usable in inline SVG stroke/filter attributes (Tailwind classes
// don't apply there).
const TONE_RGB: Record<"light" | "dark", Record<string, string>> = {
  light: { crushing: "11 122 62", ahead: "31 168 88", close: "201 154 18", risky: "224 123 34", behind: "220 61 69" },
  dark: { crushing: "25 150 85", ahead: "47 190 107", close: "232 197 71", risky: "240 145 59", behind: "229 72 77" },
};

export function EquityMeter({ equityPct }: { equityPct: number }) {
  const [display, setDisplay] = useState(0);
  const [theme] = useTheme();
  const tone = equityTone(equityPct);
  const rgb = TONE_RGB[theme][tone];
  const color = `rgb(${rgb})`;
  const glowColor = `rgba(${rgb!.replace(/ /g, ", ")}, 0.4)`;

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const from = display;
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (equityPct - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equityPct]);

  const circumference = 2 * Math.PI * 54;
  const offset = circumference * (1 - Math.min(100, Math.max(0, display)) / 100);

  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-base-border"
        />
        <motion.circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold tabular-nums">{display.toFixed(1)}%</span>
        <span className="text-xs text-base-muted">אקוויטי</span>
      </div>
    </div>
  );
}
