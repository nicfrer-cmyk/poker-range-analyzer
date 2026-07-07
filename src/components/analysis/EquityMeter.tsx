"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { equityTone } from "@/components/ui/Badge";

const TONE_HEX: Record<string, string> = {
  crushing: "#0F6B3F",
  ahead: "#2FBE6B",
  close: "#E8C547",
  risky: "#F0913B",
  behind: "#E5484D",
};

export function EquityMeter({ equityPct }: { equityPct: number }) {
  const [display, setDisplay] = useState(0);
  const tone = equityTone(equityPct);
  const color = TONE_HEX[tone];

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
          style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold tabular-nums">{display.toFixed(1)}%</span>
        <span className="text-xs text-base-muted">hero equity</span>
      </div>
    </div>
  );
}
