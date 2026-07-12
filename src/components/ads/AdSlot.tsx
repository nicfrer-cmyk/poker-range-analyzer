"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { usePlan } from "@/lib/usePlan";

const CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

// Pages where an ad would compete with an upgrade pitch or a Pro-only paywall message.
const EXCLUDED_PATH_PREFIXES = ["/billing", "/range-vs-range", "/icm"];

/**
 * Google AdSense Auto ads loader, active only for FREE-plan users (Pro users are already paying
 * to skip this) and only outside `EXCLUDED_PATH_PREFIXES`. Auto ads (not a manually placed ad
 * unit) — Google scans the page and places ads itself once this script is present, so there's no
 * ad-slot id to configure, just the publisher's NEXT_PUBLIC_ADSENSE_CLIENT_ID (see .env.example).
 * Same "degrade gracefully, never fake" pattern as Turnstile/analytics — renders nothing until
 * that env var is set.
 *
 * Keyed by pathname so navigating into/out of an excluded page mounts/unmounts the script
 * cleanly instead of leaving a stale instance from a previous eligible page.
 */
export function AdSlot() {
  const pathname = usePathname();
  const { plan, loading } = usePlan();

  const eligible =
    Boolean(CLIENT_ID) &&
    !loading &&
    plan === "FREE" &&
    !EXCLUDED_PATH_PREFIXES.some((p) => pathname?.startsWith(p));

  if (!eligible) return null;

  return (
    <Script
      key={pathname}
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
