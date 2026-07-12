import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/appUrl";

// Only the genuinely public marketing/auth pages are worth indexing — everything under the
// authenticated (app) route group is gated behind login anyway, so there's nothing for a
// crawler to usefully index there (and no reason to advertise its URL structure).
const PUBLIC_INDEXABLE_PATHS = ["/welcome", "/login", "/signup", "/terms", "/privacy"];

export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: [...PUBLIC_INDEXABLE_PATHS, "/ads.txt"],
        disallow: "/",
      },
      // AdSense's own crawler needs to reach /ads.txt (and, for its separate ongoing ad-quality
      // review, whatever pages actually carry ads — see src/components/ads/AdSlot.tsx) — kept as
      // its own rule rather than loosening the "*" block above, which is deliberately restrictive
      // since most of this app sits behind login and there's nothing there for a search crawler
      // to usefully index.
      {
        userAgent: "Mediapartners-Google",
        allow: "/",
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
