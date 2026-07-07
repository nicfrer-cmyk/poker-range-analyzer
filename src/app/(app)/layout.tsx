import { AppShell } from "@/components/layout/AppShell";

// Every page under this route group is auth-gated by `middleware.ts` — but Next.js will
// happily statically prerender a "use client" page with no server data fetching, and once
// that HTML is cached by Netlify's edge CDN, the CDN serves it directly on a cache hit
// *without invoking the middleware/edge function at all*, silently bypassing the gate. Forcing
// dynamic rendering for the whole group means every request is served from the origin (where
// middleware always runs), not the edge cache.
export const dynamic = "force-dynamic";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
