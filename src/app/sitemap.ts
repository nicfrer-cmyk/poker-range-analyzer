import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/appUrl";

// Same set of public pages as robots.ts's allow-list — nothing under the authenticated (app)
// route group belongs in a sitemap.
const PUBLIC_PATHS = ["/welcome", "/login", "/signup", "/terms", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppUrl();
  return PUBLIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
}
