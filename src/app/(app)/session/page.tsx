"use client";

import Link from "next/link";
import { SessionDashboard } from "@/components/session/SessionDashboard";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { Button } from "@/components/ui/Button";
import { useMockPlan } from "@/lib/useMockPlan";
import { canPerformAction } from "@/lib/plan";

export default function SessionReviewPage() {
  const [plan] = useMockPlan();
  const gate = canPerformAction(plan, "useLeakFinder");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Session Review &amp; Leak Finder</h1>
      {!gate.allowed ? (
        <ComingSoon
          wave="Pro feature"
          title="Unlock Leak Finder with Pro"
          description={gate.reason ?? "This feature requires Pro."}
        />
      ) : (
        <SessionDashboard />
      )}
      {!gate.allowed && (
        <div className="flex justify-center">
          <Link href="/billing">
            <Button>Upgrade to Pro</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
