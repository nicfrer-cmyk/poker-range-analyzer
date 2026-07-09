import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/appUrl";

// Only the genuinely public marketing/auth pages are worth indexing — everything under the
// authenticated (app) route group is gated behind login anyway, so there's nothing for a
// crawler to usefully index there (and no reason to advertise its URL structure).
const PUBLIC_INDEXABLE_PATHS = ["/welcome", "/login", "/signup", "/terms", "/privacy"];

export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl();
  return {
    rules: {
      userAgent: "*",
      allow: PUBLIC_INDEXABLE_PATHS,
      disallow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
