"use client";

// Static fallback the service worker (public/sw.js) serves for a failed page navigation while
// offline. Must stay a plain, unauthenticated page — precached at install time, so it has to
// render correctly with zero network access.

import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/ui/Panel";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Panel className="w-full max-w-sm">
        <PanelBody className="space-y-4 text-center">
          <span className="text-2xl">📡</span>
          <h1 className="text-lg font-semibold">אין חיבור לאינטרנט</h1>
          <p className="text-sm text-base-muted">
            נראה שאין כרגע חיבור לרשת. אפשר לבדוק את החיבור ולנסות שוב.
          </p>
          <Button className="w-full" onClick={() => window.location.reload()}>
            נסה שוב
          </Button>
        </PanelBody>
      </Panel>
    </div>
  );
}
