"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { usePlan } from "@/lib/usePlan";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const SLOT_ID = process.env.NEXT_PUBLIC_ADSENSE_SLOT_BANNER;

// Pages where a banner would compete with an upgrade pitch or a Pro-only paywall message.
const EXCLUDED_PATH_PREFIXES = ["/billing", "/range-vs-range", "/icm"];

/**
 * Google AdSense banner, shown only to FREE-plan users (Pro users are already paying to skip
 * this) and only outside `EXCLUDED_PATH_PREFIXES`. Same "degrade gracefully, never fake" pattern
 * as Turnstile/analytics — renders nothing until both NEXT_PUBLIC_ADSENSE_CLIENT_ID and
 * NEXT_PUBLIC_ADSENSE_SLOT_BANNER are set (see .env.example).
 *
 * `<ins>` is keyed by pathname so navigating between an excluded and a non-excluded page always
 * gets a fresh DOM node for `adsbygoogle.push({})` to fill — without the key, React would leave
 * the previous node in place across an unmount/remount cycle and the push-once guard would skip
 * re-filling it, showing an empty slot.
 */
export function AdSlot() {
  const pathname = usePathname();
  const { plan, loading } = usePlan();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const pushedForPath = useRef<string | null>(null);

  const eligible =
    Boolean(CLIENT_ID) &&
    Boolean(SLOT_ID) &&
    !loading &&
    plan === "FREE" &&
    !EXCLUDED_PATH_PREFIXES.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (!eligible || !scriptLoaded || pushedForPath.current === pathname) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedForPath.current = pathname;
    } catch {
      // adsbygoogle not ready (e.g. blocked by an ad blocker) — expected/harmless, nothing to
      // recover from.
    }
  }, [eligible, scriptLoaded, pathname]);

  if (!CLIENT_ID || !SLOT_ID) return null;

  return (
    <>
      <Script
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`}
        strategy="afterInteractive"
        crossOrigin="anonymous"
        onLoad={() => setScriptLoaded(true)}
      />
      {eligible && (
        <div className="my-4 flex justify-center overflow-hidden">
          <ins
            key={pathname}
            className="adsbygoogle"
            style={{ display: "block", width: "100%" }}
            data-ad-client={CLIENT_ID}
            data-ad-slot={SLOT_ID}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      )}
    </>
  );
}
