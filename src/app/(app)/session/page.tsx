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
      <h1 className="text-2xl font-semibold">סקירת סשן וגילוי דליפות</h1>
      {!gate.allowed ? (
        <ComingSoon
          wave="תכונת פרו"
          title="פתח את גילוי הדליפות עם פרו"
          description={gate.reason ?? "התכונה הזו דורשת מנוי פרו."}
        />
      ) : (
        <SessionDashboard />
      )}
      {!gate.allowed && (
        <div className="flex justify-center">
          <Link href="/billing">
            <Button>שדרוג לפרו</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
